# Changelog

All notable changes to this project are documented here
([Keep a Changelog](https://keepachangelog.com), Conventional Commits labels).

## [Unreleased]

### Added
- CI workflow (lint, typecheck, tests, `npm audit`) on PRs and pushes to `main`.
- Dependabot for npm, GitHub Actions and Docker.
- Dependabot auto-merge workflow: patch and minor updates are squash-merged automatically once
  all required checks on `main` pass. Major, non-semver and maintainer-changed updates stay
  manual. Merges use `GITHUB_TOKEN`; CI, Docker publish and SCA are then re-dispatched on
  `main` because such merges trigger no workflow runs on their own.
- Explicit 3-day release-age cooldown for Dependabot version updates (all ecosystems).

### Added (security)
- SSRF protection on `POST /api/connection`: link-local/cloud-metadata addresses are always
  rejected; optional `ALLOWED_BROKER_HOSTS` allowlist. Literal-hostname check only (no DNS
  rebinding protection) - documented in `brokerUrlPolicy.ts`.
- `TRUST_PROXY` env var (proxy hop count, default 1) so a bare `docker run` can set 0 and
  X-Forwarded-For can't be spoofed to bypass rate limits.

### Changed
- `SankeyChart` split: the edge pipeline (`buildDisplayEdges`) and SVG export (`exportSvg`) are
  now pure, unit-tested modules; the d3 link-id casts live in one documented helper.
- Server logs are now one JSON object per line (`timestamp`, `level`, `message`, `error`),
  which also prevents log forging via newlines in user-supplied values (CWE-117).
- `GET /api/endpoints` now returns `{ endpoints, errors }`. One unreachable broker no longer
  blanks a multi-broker diagram: the reachable ones are drawn and the UI warns about the rest.
  Only if every broker fails does the route still answer 502. (Breaking for API consumers.)

### Fixed
- Dependency advisories that failed the `npm audit` gate: `vitest` / `@vitest/coverage-v8`
  raised to `^4.1.12`; lockfile refresh for `body-parser` 2.4.0, `undici` 8.12.3, `qs` 6.17.1
  and `ip-address` 10.7.5.
- Workflows (CI push, Docker publish, SCA scan, Dependabot auto-merge) still targeted `master`
  after the default branch was renamed to `main`, so they never ran on `main`.
- `POST /api/connection` and `/api/login` returned 500 instead of 400 when sent without a JSON
  body; the connect body is now validated by a typed, unit-tested `parseConnectBody` (with
  length limits) instead of an unchecked cast.
- Broker credentials no longer outlive the session: connections have an absolute 8 h TTL
  (swept every 10 min) matching the cookie, instead of staying in memory until restart.
- Login issues a new session id (session fixation); broker connections move with it.
- No session/cookie is created for visitors who never log in or connect (`saveUninitialized:
  false`), removing an unauthenticated memory-growth vector.
- SEMP throttle now actually spaces out concurrent requests (slot reservation); previously
  `Promise.all` fan-out fired all requests at once and ignored the <=10 req/s limit.
- SEMP requests time out (default 15 s) instead of hanging on an unresponsive broker.
- Pagination links (`nextPageUri`) are only followed on the origin the user connected to,
  so a malicious broker cannot receive the Basic Auth header or trigger requests to other hosts.

### Changed
- Docker publish now runs only after lint, typecheck, tests and audit pass.
