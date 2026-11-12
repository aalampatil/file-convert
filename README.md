# Folio

**A new format. Same good work.**

A full-stack Next.js file converter for Markdown, Word, PDF, and images. Upload a file, follow its progress, and download a real converted document.

[Contributing](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Support](SUPPORT.md) · [MIT license](LICENSE)

## What it converts

| Input                         | Output         | Behavior                                                                                                                |
| ----------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Markdown (`.md`, `.markdown`) | PDF            | Headings, lists, code blocks, and text tables. Raw HTML is ignored; image alt text is retained without loading images.  |
| Word (`.doc`, `.docx`)        | PDF            | LibreOffice renders the document. Requires LibreOffice locally; included in Docker.                                     |
| PDF                           | Word (`.docx`) | Extracts selectable text with page breaks. Images, tables, columns, and original styling are not reconstructed. No OCR. |
| PNG, JPG, JPEG, WebP          | PNG, JPG, WebP | Real image conversion, with orientation correction.                                                                     |
| Plain text (`.txt`)           | PDF            | UTF-8 text in a paginated document.                                                                                     |

Unsupported conversions are rejected. Files are never merely renamed.

The default upload limit is 25 MB. Markdown and text inputs are limited to 2 MB; PDFs to 200 pages; images to 40 million pixels. Downloads expire one hour after upload. Active conversions finish before cleanup, which runs every minute. Session history keeps up to 20 job IDs in your browser; file contents stay on the server.

## Local development

Use **Node.js 24 LTS** and npm. Install LibreOffice if you need Word-to-PDF conversion; other conversions work without it.

```bash
git clone https://github.com/aalampatil/file-convert.git
cd file-convert
npm ci
npm run dev
```

Open **http://localhost:3000**. Copy [`.env.example`](.env.example) to `.env.local` when you need custom settings. On Windows, the default LibreOffice path is `C:/Program Files/LibreOffice/program/soffice.exe`; on Linux it is `/usr/bin/libreoffice`.

`npm run dev` compiles the conversion workers before starting Next.js. Restart it after changing converter code. Normal UI and route changes use Next.js hot reload.

## Production

The whole repository runs as **one self-hosted Next.js application**. The production entry point uses the Next.js request handler and adds verified client addresses, request timeouts, and graceful worker shutdown. There is no separate Vite or Express application.

The recommended deployment is the included Docker Compose setup:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f
```

Open **http://localhost:3000**. The image installs LibreOffice and Unicode fonts, runs as a non-root user, and stores jobs and downloads in a named persistent volume. Compose sets a read-only root filesystem, memory/CPU/process limits, and a health check. Put a TLS reverse proxy in front of it for public deployment.

For a native Node.js deployment:

```bash
npm ci
npm run build
npm start
```

The health endpoint is `GET /healthz`; `wordConversion` indicates whether LibreOffice is available. Use `npm start` for production so client IP rate limits and shutdown handling are active. Do not substitute `next start` without providing the same lifecycle behavior.

### Operational boundaries

- Run **one application instance per data directory**. The bounded queue is in memory; job metadata and outputs are persisted to disk. This is designed for a single server, not horizontally scaled serverless functions.
- Two conversions run at a time by default, with 20 waiting slots and 200 stored job records. Saturation returns HTTP 503 rather than admitting unlimited work.
- Conversion workers have a 120-second deadline and a 384 MB JavaScript heap cap. Container limits also bound native-library memory.
- Completed jobs survive restarts. Interrupted jobs are marked failed on startup and must be uploaded again.
- Inputs are removed after conversion. Expired metadata and outputs are removed on the next cleanup pass. No backups are created by the app; operators control volume backups and their retention.
- Keep capability download links private. There is no user account or shared job listing.
- Configure proxy upload/body/time limits to match the application. Set `TRUST_PROXY_HOPS` only when the app is reachable exclusively through that exact proxy topology. The production entry point overwrites incoming client-identity headers.
- Keep the host, container base image, LibreOffice, and npm dependencies patched. For public untrusted uploads, restrict worker egress at the infrastructure layer and provision appropriate ingress abuse protection.

### Configuration

| Variable                     | Default                       | Meaning                                   |
| ---------------------------- | ----------------------------- | ----------------------------------------- |
| `PORT`                       | `3000`                        | HTTP port                                 |
| `DATA_DIR`                   | `./data`                      | Writable persistent storage               |
| `MAX_UPLOAD_MB`              | `25`                          | Upload limit, 1–100 MB                    |
| `CONVERSION_CONCURRENCY`     | `2`                           | Concurrent workers, 1–4                   |
| `MAX_PENDING_JOBS`           | `20`                          | Waiting slots, 1–100                      |
| `MAX_STORED_JOBS`            | `200`                         | Retained records, 1–2000                  |
| `CONVERSION_TIMEOUT_SECONDS` | `120`                         | Deadline, 5–600 seconds                   |
| `FILE_RETENTION_HOURS`       | `1`                           | Retention, 1–24 hours                     |
| `LIBREOFFICE_PATH`           | Platform default              | Absolute path to LibreOffice executable   |
| `PDF_FONT_PATH`              | DejaVu Sans if available      | PDF body font                             |
| `PDF_BOLD_FONT_PATH`         | DejaVu Sans Bold if available | PDF heading font                          |
| `TRUST_PROXY_HOPS`           | `0`                           | Number of trusted reverse proxy hops, 0–5 |

Invalid numeric settings fail early. The application does not need database credentials or an external conversion service.

## Checks

See the [verification record](docs/VERIFICATION.md) for the production-container results and tested boundaries.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Conversion tests verify file signatures and extracted content, invalid input, queue limits, expiry, and restart recovery. Word tests require LibreOffice; set `REQUIRE_OFFICE=1` to make its absence a failure. CI installs LibreOffice and runs these tests. Playwright tests exercise the production UI, upload, conversion, download, session restoration, errors, and mobile layout.

## Structure

```text
src/app/              Next.js pages, metadata, and API route handlers
src/components/       Converter workspace and reusable UI
src/lib/              Browser API client and shared public types
src/server/           Streaming upload parser and conversion services
scripts/start.mjs     Production Next.js HTTP server and shutdown lifecycle
tests/                Conversion and browser tests
.worker/              Compiled worker code (generated; not committed)
data/                 Private files and job records (not committed)
.github/              CI, issue forms, and community templates
```

## Contributing and community

Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started. Use the [issue forms](https://github.com/aalampatil/file-convert/issues/new/choose) for bugs and feature requests. Please use synthetic files in reports and follow our [code of conduct](CODE_OF_CONDUCT.md).

Security issues belong in the [private reporting process](SECURITY.md), not a public bug report. Maintainer repository-setting guidance is in [`.github/REPOSITORY.md`](.github/REPOSITORY.md).

## License

[MIT](LICENSE), copyright © 2026 Folio contributors.
