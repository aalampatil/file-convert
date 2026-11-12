"""Reconstruct PDF layout as editable DOCX, rejecting detected content loss."""

import contextlib
from collections import Counter
import json
import logging
import os
from pathlib import Path
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from zipfile import ZipFile

import cv2
import pymupdf
with contextlib.redirect_stdout(sys.stderr):
    from pdf2docx import Converter


class PreservationError(ValueError):
    pass


def characters(text):
    # Only discard soft/line-wrap hyphenation; literal minus signs are content.
    normalized = re.sub(r"(?<=[^\W\d_])-\r?\n(?=[^\W\d_])", "", unicodedata.normalize("NFKC", text))
    return Counter(
        character
        for character in normalized
        if not character.isspace() and character != "\u00ad"
    )


def convert(source, destination):
    cv2.setNumThreads(1)
    logging.disable(logging.CRITICAL)
    with pymupdf.open(source) as document:
        if document.needs_pass:
            raise PreservationError("This PDF is password-protected. Unlock it before converting.")
        if document.page_count > 200:
            raise PreservationError("PDFs are limited to 200 pages. Split this document and try again.")
        source_text = ""
        source_images = 0
        for page in document:
            source_text += page.get_text()
            images = page.get_image_info()
            if any(image["width"] * image["height"] > 40_000_000 for image in images):
                raise PreservationError("This PDF contains an image that exceeds the 40-million-pixel limit.")
            source_images += len(images)
        if not source_text.strip() and not source_images:
            raise PreservationError("No selectable text or images were found in this PDF.")

    converter = Converter(str(source))
    try:
        # Never skip pages that fail parsing: a partial document is not a success.
        with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink):
            converter.convert(
                str(destination), multi_processing=False, ignore_page_error=False,
                raw_exceptions=True
            )
    finally:
        converter.close()

    with ZipFile(destination) as archive:
        xml = ET.fromstring(archive.read("word/document.xml"))
        namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        result_text = "".join(node.text or "" for node in xml.findall(".//w:t", namespaces))
        drawings = len(xml.findall(".//w:drawing", namespaces)) + len(xml.findall(".//w:pict", namespaces))
        if characters(source_text) - characters(result_text):
            raise PreservationError("This PDF's text could not be fully preserved. No incomplete Word file was returned.")
        if source_images and drawings < source_images:
            raise PreservationError("This PDF's images could not be fully preserved. No incomplete Word file was returned.")


if __name__ == "__main__":
    try:
        convert(Path(sys.argv[1]), Path(sys.argv[2]))
        print(json.dumps({"ok": True}))
    except Exception as error:
        destination = Path(sys.argv[2])
        destination.unlink(missing_ok=True)
        if not isinstance(error, PreservationError):
            import traceback
            traceback.print_exc(file=sys.stderr)
        message = str(error) if isinstance(error, PreservationError) else "This PDF could not be converted while preserving its structure."
        print(json.dumps({"error": message}))
        sys.exit(1)
