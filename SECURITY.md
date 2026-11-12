# Security policy

## Supported versions

Security fixes target the latest commit on `main`. Older commits and forks are not separately maintained. Update to the current code and rebuild the container regularly.

## Reporting a vulnerability

Do not disclose exploit details, confidential documents, secrets, or live download links in public issues.

Use the repository's [Security tab](https://github.com/aalampatil/file-convert/security) and **Report a vulnerability** when private vulnerability reporting is enabled. The direct reporting page is [here](https://github.com/aalampatil/file-convert/security/advisories/new).

If that option is unavailable, open an issue titled **Private security contact requested**, without technical or personal details. A maintainer must arrange a private reporting channel before you share the report. No security email address is currently published. For abuse on GitHub itself, use GitHub's private reporting tools.

Include affected commit/version, environment, impact, minimal reproduction using synthetic files, and any suggested fix once a private channel is available. Maintainers will investigate and coordinate disclosure; there is no guaranteed response SLA or bounty program.

## Deployment responsibilities

Folio processes untrusted files. Use the non-root container, resource limits, persistent storage, and a TLS reverse proxy. Keep Node.js, LibreOffice, native parsers, the base image, and npm dependencies updated. Restrict worker egress for public deployments. Do not mount host secrets into the container.

Jobs use random capability IDs. Anyone with a live download link can access that file; there is no account-based authorization. Keep URLs private. Inputs are removed after processing; outputs and records expire after the configured retention window and are removed by periodic cleanup. Operators control backups and their retention.

Run one application instance per data directory. Use `npm start` to preserve the verified client-address handling. Only trust forwarded client addresses when the exact proxy topology is controlled. See [README.md](README.md) for operational limits.
