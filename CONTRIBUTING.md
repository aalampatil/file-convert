# Contributing to Folio

Thank you for helping improve file conversion. All contributors must follow the [code of conduct](CODE_OF_CONDUCT.md).

## Before starting

Search existing [issues](https://github.com/aalampatil/file-convert/issues) and pull requests. For substantial features or architectural changes, open a feature request describing the user problem and proposed scope. Small fixes and documentation improvements can go directly to a pull request.

Report vulnerabilities through [SECURITY.md](SECURITY.md). Do not include private documents, secrets, or live download links in public discussions.

## Development setup

1. Fork the repository and create a branch from `main`.
2. Install Node.js 24 LTS and run `npm ci`.
3. Install LibreOffice if your change touches Word conversion.
   For PDF-to-Word work, create `.venv` with Python 3.11+ and install `requirements.txt` with `--require-hashes` as shown in the README.
4. Optionally copy `.env.example` to `.env.local`.
5. Run `npm run dev` and visit http://localhost:3000.

The compiled conversion workers are built at startup. Restart development after editing worker/converter code. See the [README](README.md) for configuration and deployment.

## Making changes

- Keep commits focused and describe the resulting behavior.
- Keep TypeScript strict; validate uploads and supported conversion pairs on the server.
- Never expose filesystem paths or introduce a renamed-file fallback.
- Preserve keyboard navigation, labels, focus styles, mobile layout, and reduced-motion support.
- Avoid fetching resources embedded in uploaded files.
- Add meaningful tests for conversion behavior, security boundaries, or regressions.
- Use generated, non-sensitive fixtures. Keep user files and build output out of Git.
- Update the README when formats, limits, configuration, or commands change.

## Validation

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

For document-conversion changes, set `REQUIRE_OFFICE=1` and `REQUIRE_PDF_LAYOUT=1` when running tests so missing native engines are failures. CI installs both. Structure tests cover headings, emphasis, nested lists, table cells, embedded images, reading order and mixed page sizes. Format changes with `npm run format`.

## Pull requests

Use the pull request template. Explain the problem and resulting behavior, link related issues, and include test evidence. Include desktop/mobile screenshots for visible changes and note conversion limitations. Keep the PR limited to a reviewable scope.

Maintainers review correctness, accessibility, security, tests, and documentation. Respond to review feedback or explain tradeoffs. Submitted code is licensed under the [MIT license](LICENSE); you must have the right to contribute it. No CLA is required.

## Community support

Use [SUPPORT.md](SUPPORT.md) for questions, bugs, and feature requests. Maintainers are volunteers; no response deadline or support SLA is promised.
