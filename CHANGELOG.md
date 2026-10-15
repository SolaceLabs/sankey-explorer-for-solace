# Changelog

All notable changes to this project are documented here
([Keep a Changelog](https://keepachangelog.com), Conventional Commits labels).

## [Unreleased]

### Added
- CI workflow (lint, typecheck, tests, `npm audit`) on PRs and pushes to `master`.
- Dependabot for npm, GitHub Actions and Docker.

### Changed
- Docker publish now runs only after lint, typecheck, tests and audit pass.
