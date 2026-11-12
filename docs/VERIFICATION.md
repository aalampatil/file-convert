# Verification record

Validated on 2026-11-12 against the self-hosted Next.js production application.

## Results

| Check                                            | Result                              |
| ------------------------------------------------ | ----------------------------------- |
| ESLint                                           | Passed                              |
| TypeScript                                       | Passed                              |
| Next.js production build                         | Passed, with all API routes present |
| Conversion and streaming-upload tests in Docker  | 15 passed; none skipped             |
| Chromium browser tests against production Docker | 6 passed; none skipped              |
| Production dependency audit                      | 0 vulnerabilities                   |
| Full dependency audit                            | 0 vulnerabilities                   |
| Container restart and persisted PDF download     | Passed                              |

The container used Node.js 24, LibreOffice, and the production entry point. It ran as a non-root user with a read-only root filesystem, a writable data volume and temporary directory, dropped capabilities, and memory/CPU/process limits. `/healthz` reported both readiness and Word conversion availability.

## Verified flows

- Markdown and text generate PDFs whose extracted text matches the fixture content.
- DOCX and binary legacy DOC render through LibreOffice to real PDFs.
- PDF text exports to an editable DOCX archive containing the expected content.
- Images are encoded in the requested format.
- Blank/scanned and corrupt PDFs fail clearly; unsupported pairs never copy or relabel inputs.
- Streaming uploads accept one file and one format, preserve Unicode names, retain extensions when truncating long names, and reject excess parts and oversized files without leaving uploads behind.
- Queue admission, expiry cleanup, hidden filesystem paths, and interrupted-job recovery are tested.
- Browser upload, progress, download, session restoration, failed jobs, retry after connection loss, and mobile overflow checks pass.
- A completed conversion remained available after restarting the actual production container; its downloaded signature remained `%PDF-`.

Desktop and mobile screenshots are generated under the ignored `test-results/` directory by the browser suite.

## Reproduce

See the [README](../README.md#checks) for local commands. `docker build -t folio:local .` requires all conversion tests, including LibreOffice, to pass during the build. CI installs LibreOffice and runs the quality and browser checks independently.

Local Windows runs skip the Word test when LibreOffice is not installed. The production-container run above required it and skipped no tests.

## Scope

This verifies the included single-instance deployment, not a public hosted service or a load benchmark. Public hosting still requires operator-managed TLS, storage capacity, proxy configuration, patches, and infrastructure abuse controls. PDF-to-Word extracts selectable text; it does not provide OCR or reconstruct the original layout. Audit results are point-in-time results and should be rechecked as dependencies change.
