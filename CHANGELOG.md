# Changelog

All notable changes to this project are documented here
([Keep a Changelog](https://keepachangelog.com), Conventional Commits labels).

## [Unreleased]

### Added
- CI workflow (lint, typecheck, tests, `npm audit`) on PRs and pushes to `master`.
- Dependabot for npm, GitHub Actions and Docker.

### Fixed
- SEMP throttle now actually spaces out concurrent requests (slot reservation); previously
  `Promise.all` fan-out fired all requests at once and ignored the <=10 req/s limit.
- SEMP requests time out (default 15 s) instead of hanging on an unresponsive broker.
- Pagination links (`nextPageUri`) are only followed on the origin the user connected to,
  so a malicious broker cannot receive the Basic Auth header or trigger requests to other hosts.

### Changed
- Docker publish now runs only after lint, typecheck, tests and audit pass.
