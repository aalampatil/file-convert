# Verification record

Validated on 2026-11-12 against the self-hosted Next.js production application at commit `b8b4f62`.

## Results

| Check                                                           | Result                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ESLint                                                          | Passed                                                                          |
| TypeScript                                                      | Passed                                                                          |
| Next.js production build                                        | Passed, with all API routes present                                             |
| Conversion, structure, streaming-upload and CSP tests in Docker | 23 passed; none skipped                                                         |
| Chromium browser tests against production Docker                | 7 passed; none skipped                                                          |
| Production npm dependency audit                                 | 0 vulnerabilities                                                               |
| Full npm dependency audit                                       | 0 vulnerabilities                                                               |
| Locked Python dependency advisory audit                         | No known vulnerabilities, including the production Python 3.11 package versions |
| Restart and persisted structured DOCX download                  | Passed; SHA-256 identical before and after restart                              |
| Development CSP in Chromium                                     | React debugging eval works without CSP console errors                           |
| Production CSP response                                         | `unsafe-eval` remains blocked                                                   |

The container used Node.js 24, Python 3.11, the PDF layout engine, LibreOffice, and the production entry point. It ran as a non-root user with a read-only root filesystem, a writable data volume and temporary directory, dropped capabilities, and memory/CPU/process limits. `/healthz` reported readiness and availability of both native conversion engines.

## Verified flows

- Markdown preserves heading levels, bold/italic text, nested list order, links, table cells and embedded PNG/JPEG images.
- Wrapped inline code in Markdown table cells does not overlap the following row.
- Markdown rejects unresolved image references and raw HTML instead of silently omitting them.
- DOCX and binary legacy DOC render through LibreOffice to real PDFs.
- A structured Word fixture retains its heading, text, table, image and page dimensions after PDF conversion.
- PDF-to-Word reconstructs emphasis, table rows and cells, embedded images, reading order and portrait/landscape sections.
- Negative values retain their minus signs. The content comparison preserves literal hyphens and only tolerates soft/line-wrap hyphenation.
- Image-only PDF pages remain images in DOCX; blank and corrupt PDFs fail clearly.
- The PDF converter does not skip failed pages and checks the generated document for missing source text and images before accepting it.
- Browser-driven Markdown → PDF → Word downloads contain the expected text, emphasis, table structure and image assets.
- Images are encoded in the requested format. Unsupported pairs never copy or relabel inputs.
- Streaming uploads enforce limits, preserve Unicode names, retain extensions when shortening long names, and clean up rejected uploads.
- Queue admission, expiry, hidden filesystem paths and interrupted-job recovery are tested.
- Browser upload, download, session restoration, failed jobs, connection retry and mobile overflow checks pass.
- A structured DOCX remained downloadable after restarting the actual production container, with its complete file hash unchanged.

Desktop and mobile screenshots are generated under the ignored `test-results/` directory by the browser suite.

## Reproduce

See the [README](../README.md#checks) for local commands. `docker build -t folio:local .` requires the native engines and all conversion/structure tests to pass. CI installs LibreOffice and the hash-locked Python dependencies and runs quality and browser checks independently.

Local runs can skip LibreOffice-dependent tests when it is absent. Set `REQUIRE_OFFICE=1` and `REQUIRE_PDF_LAYOUT=1` to require the native engines. The production-container run above required both and skipped no tests.

## Scope

This verifies the included single-instance deployment, not a public hosted service or a load benchmark. Public hosting requires operator-managed TLS, storage capacity, proxy configuration, patches and abuse controls. Complex PDF layouts can still need manual review; the checks do not guarantee pixel-identical rendering for every document. Image-only pages remain images, and OCR is not provided. Dependency audits are point-in-time results.

Native components retain their own licenses; see [third-party notices](../THIRD_PARTY_NOTICES.md).
