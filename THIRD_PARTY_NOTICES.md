# Third-party components

The repository's MIT license covers its original source code. It does not relicense dependencies or the tools included in the Docker image. Installed distributions retain their license files and notices.

| Component       | Use                                         | License reference                                                                                                                                 |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| pdf2docx        | Reconstruct PDF layout as DOCX              | [MIT](https://github.com/ArtifexSoftware/pdf2docx/blob/master/LICENSE)                                                                            |
| PyMuPDF / MuPDF | Read PDF text, image and layout information | [GNU AGPL v3](https://github.com/pymupdf/PyMuPDF/blob/1.28.2/COPYING); review the project's separate commercial licensing options when applicable |
| LibreOffice     | Render Word documents as PDF                | [LibreOffice licensing](https://www.libreoffice.org/about-us/licenses/)                                                                           |
| python-docx     | Write reconstructed DOCX files              | [MIT](https://github.com/python-openxml/python-docx/blob/master/LICENSE)                                                                          |

Review these upstream terms for your distribution and deployment. The MIT label for this repository is not a statement that every bundled dependency is MIT-licensed.

Python dependencies are version- and hash-locked in `requirements.txt`. PyMuPDF is constrained to the compatible 1.x API in `requirements.in`. The pdf2docx project is community-maintained; Artifex no longer provides active maintenance. Dependency updates should pass the structure-preservation tests before release.
