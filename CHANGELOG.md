# Changelog

All notable changes to this project are documented here
([Keep a Changelog](https://keepachangelog.com), Conventional Commits labels).

## [Unreleased]

### Added
- CI workflow (lint, typecheck, tests, `npm audit`) on PRs and pushes to `master`.
- Dependabot for npm, GitHub Actions and Docker.

### Added (security)
- SSRF protection on `POST /api/connection`: link-local/cloud-metadata addresses are always
  rejected; optional `ALLOWED_BROKER_HOSTS` allowlist. Literal-hostname check only (no DNS
  rebinding protection) - documented in `brokerUrlPolicy.ts`.
- `TRUST_PROXY` env var (proxy hop count, default 1) so a bare `docker run` can set 0 and
  X-Forwarded-For can't be spoofed to bypass rate limits.

### Fixed
- SEMP throttle now actually spaces out concurrent requests (slot reservation); previously
  `Promise.all` fan-out fired all requests at once and ignored the <=10 req/s limit.
- SEMP requests time out (default 15 s) instead of hanging on an unresponsive broker.
- Pagination links (`nextPageUri`) are only followed on the origin the user connected to,
  so a malicious broker cannot receive the Basic Auth header or trigger requests to other hosts.

### Changed
- Docker publish now runs only after lint, typecheck, tests and audit pass.
