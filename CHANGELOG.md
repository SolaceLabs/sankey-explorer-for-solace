# Changelog

All notable changes to this project are documented here
([Keep a Changelog](https://keepachangelog.com), Conventional Commits labels).

## [Unreleased]

### Added
- Live SEMP v2 metrics API: `GET /api/metrics` returns one telemetry sample (current and
  1-minute-average message rates, spool usage and quota, unacked messages, ingress/egress
  state) for every queue, topic endpoint and client of every connected Message VPN. Three
  `select`-limited list calls per VPN; one failing broker still yields a partial 200 like
  `/api/endpoints`. `GET /api/metrics/consumers` lists the consumer flows (`txFlows`) of one
  queue or topic endpoint on demand. Missing or malformed SEMP fields come back as `null`,
  never as a fake `0`.
- Client-side live metrics model: `buildEndpointMetricsMap` maps samples onto diagram node ids
  (same broker-suffix rule as the nodes), `classifyEndpointActivity` rates each endpoint as
  unknown / idle / active / backlog (spool growing since the previous sample, at least 80% of its
  quota, or holding messages with nothing going out), `formatMetrics` renders bounded summaries.
  `useMetricsPolling` (pure `metricsPollingReducer` inside) polls with a `setTimeout` chain, at
  most one request in flight, aborts on pause/reset/unmount, keeps the last good sample on
  errors and pauses and clears itself when its `resetKey` (the loaded configuration) changes.
- Live metrics overlay in the diagram: toolbar group with start/pause, interval (5 s / 15 s /
  30 s), "Refresh now", polling state with the time of the last good sample, transient poll and
  per-broker errors (the last good sample and the diagram stay), and a legend. Endpoints get a
  status dot (filled green active, filled orange backlog, hollow idle) and a bounded metrics line
  (`in / out msg/s · spool size and fill level ↑/↓`), whose width the layout reserves once so it
  doesn't jump per poll; links into receiving endpoints turn green, links into idle ones fade.
  Node tooltips spell the status out. The detail panel shows the endpoint's rates (current and
  1-minute average), spool, quota, trend, unacked and ingress/egress state, plus an on-demand
  consumer list for queues and topic endpoints. Loading a configuration (initial load, Refresh,
  managing or disconnecting Message VPNs, logout) pauses polling and clears all samples.
- Diagram toolbar reorganized into two menus with built-in explanations: "View: Data flow"
  (which flows to draw, each option explained; show direct subscribers; order endpoints by)
  and "Live traffic: every 15 s / off" (what the feature does, one "Update automatically"
  choice of Off / 5 s / 15 s / 30 s, last and next update, "Update now", and what each status
  means). Both share one disclosure behavior with the Message VPN menu (Escape, outside click).
- Live statuses renamed to Flowing, Piling up and Idle and drawn under each endpoint as icon,
  word and the numbers behind it (e.g. "Piling up · 80.0 MB waiting · 80% full · growing")
  instead of a colored dot.
- CI workflow (lint, typecheck, tests, `npm audit`) on PRs and pushes to `main`.
- Dependabot for npm, GitHub Actions and Docker.
- Dependabot auto-merge workflow: GitHub's native auto-merge (squash) is enabled for patch and
  minor updates, so GitHub merges them once all required checks on `main` pass. Major,
  non-semver and maintainer-changed updates stay manual; auto-merge is switched off again when
  someone else pushes to the PR. Auto-merge is enabled with a GitHub App token so the merge
  triggers CI, Docker publish and SCA on `main`. The workflow refuses to run unless `main`
  requires the `verify` check.
- Explicit 3-day release-age cooldown for Dependabot version updates (all ecosystems).
- Diagram search in the top bar (pill field, compact while idle and wider while focused,
  `⌘K` / `Ctrl K` to focus): finds a topic by full
  path (a trailing `/*` means "this level") or an endpoint by name and selects it; after a hit
  the field is cleared and releases focus, a miss keeps the typed text. Suggestions
  appear in a list directly below the field, same width, usable with arrow keys, Enter, Escape
  and the mouse (ARIA combobox; no native `<datalist>`, which browsers render unstyled and
  place inconsistently). Matching in the pure, tested `findNodeByQuery` / `suggestNodes`.
- Selection detail panel beside the diagram, a floating rounded Dark Blue card with rounded
  Deep Blue entries. Its summary reads "N endpoints receive topics from this branch" for a
  topic level with more levels below, and "Messages published here reach N endpoints" for a
  full topic. For a topic, every endpoint it reaches and whether
  through the endpoint's own subscription or only a wider wildcard (with the subscription
  string); for an endpoint, its declared subscriptions. "Copy topic" and "Show only this".
  Derived by the pure, tested `describeSelection` from the same edges the diagram draws.
- Q / TE / DS type badges next to every endpoint (diagram, panel, search suggestions; queue
  green, topic endpoint light blue, direct subscriber outlined; in the diagram vertically
  centered on the whole entry), column headings
  ("Level 1" ... "Endpoints"), and topic/endpoint counts plus the number of endpoints without
  subscriptions in the toolbar.

### Added (security)
- SSRF protection on `POST /api/connection`: link-local/cloud-metadata addresses are always
  rejected; optional `ALLOWED_BROKER_HOSTS` allowlist. Literal-hostname check only (no DNS
  rebinding protection) - documented in `brokerUrlPolicy.ts`.
- `TRUST_PROXY` env var (proxy hop count, default 1) so a bare `docker run` can set 0 and
  X-Forwarded-For can't be spoofed to bypass rate limits.

### Changed
- `SempV2Client.getVpnCollection` accepts an optional SEMP `select` attribute list; the
  per-broker error isolation of `/api/endpoints` moved into a shared `queryAcrossConnections`.
- `ConnectScreen` is split (296 to 155 lines): the form in `ConnectForm`, export/import in
  `ConfigFileActions`, and connecting several entries plus remembering their credentials in
  the tested `lib/brokerConnections.ts` (`connectEach`, `withNewConnectionConfig`).
- File downloads (diagram SVG, broker config YAML) share one tested `lib/downloadFile.ts`.
- The app header is its own `TopBar` component (brand, search slot, Message VPN menu, refresh,
  export slot, logout); `App` keeps only session and view state.
- `apiErrorMessage(err, fallback)` in `api/client.ts` replaces six inline
  `err instanceof ApiRequestError ? err.message : ...` checks in `App`, `ConnectScreen` and
  `LoginScreen`.
- One tested `countLabel` ("1 endpoint", "7 endpoints") replaces the two identical `plural`
  helpers in `DiagramToolbar` and `SelectionPanel`.
- `SankeyChart` is split by concern (300 to 200 lines): the flows and their gradient render in
  `SankeyLinks` with a typed link path (no more `link as never`), the selection and its
  invalidation live in `useDiagramSelection`, the canvas width in `useElementWidth`, and the
  flow highlight (`flowHighlight`, `flowThrough`) and endpoint sub-lines (`endpointSubLines`)
  are tested `lib` functions.
- Diagram colors live in one module (`lib/diagramColors.ts`): named brand colors, the role each
  plays (topic, flow, Gradient 16, selection, labels, endpoint types, badges, broker palette,
  export background) and `nodeFillColor`, instead of hex values spread over `SankeyChart`,
  `SankeyNode`, `exportSvg` and `buildEndpointBrokerColors`.
- Graph walking lives in one tested module (`lib/flowGraph.ts`: `nodeIdsOf`, `adjacencyOf`,
  `reachableFrom`, `appendTo`) instead of four hand-rolled copies in `filterToRelevantSubgraph`,
  `describeSelection`, `buildQueueSortKeys` and `removeCycles` (plus three node-id collectors);
  this also removes their non-null assertions.
- Endpoint node ids are produced and read from one table (`shared/endpointNodeId.ts`):
  `toSankeyEdges` builds "Queue: X" style ids from it, and the client's type checks, display
  names, direct-subscriber filter and colors read the type back from it instead of repeating
  the "Queue:" / "Topic Endpoint:" / "Direct Subscriber:" prefixes in five places.
- UI redesign (dark Solace look): brand block "Sankey Explorer / for Solace", Message VPNs as
  one chip with a panel holding "Manage" and "Disconnect all" (replaces three large header
  buttons), refresh as an icon button, round icon-only SVG export in the top bar right of
  refresh, toolbar with a segmented View control, toggle and sort select. Every control
  (buttons, inputs, search, VPN chip, view switch, sort) shares one height
  (`--control-height`, 42px); text fields and buttons on the login and connect screens are
  pills too. Three radii only: pills for controls, 20px for surfaces, 12px for entries
  inside a surface. The login/connect card is the same floating Dark Blue surface as the
  detail panel, with a sentence-case context line instead of the all-caps mono label; the
  connect screen's longer setup notes are folded into "Several Message VPNs, or which host
  to enter?".
- The detail panel always fits the window - from below the header before scrolling, from its
  sticky offset once pinned (`viewportFitHeight` / `useViewportFitHeight`) - and sticks while
  scrolling a tall diagram, so its buttons stay visible; a long endpoint list scrolls inside.
- Broker colors (two or more brokers) no longer use orange (warnings), bright green
  (selection), light blue (topics/topic endpoints) or white (direct subscribers). `SankeyChart` split into `DiagramToolbar`, `DiagramSearch`, `SelectionPanel`,
  `SankeyNode` and `ExportSvgButton`.
- Clicking a node or link now selects it (flow highlighted with Solace Gradient 16, other flows
  unchanged, detail panel opens) instead of filtering the diagram right away; filtering moved
  to "Show only this" / "Back to overview". Unrelated nodes are dimmed only for a clicked
  selection (once the pointer leaves it), never while just hovering.
- In data-flow mode a highlighted (hovered/selected) or focused endpoint's flow now includes
  the topics it receives only through a wildcard, e.g. hovering a `retail/orders/>` queue
  also lights up `retail/orders/created`. New `includeImpliedAncestors` option on
  `filterToRelevantSubgraph`; its default (declared subscriptions only) is unchanged.
- Endpoint bars use the badge colors (queue green, topic endpoint light blue, direct
  subscriber white) when only one broker is connected; with several brokers they keep the
  per-broker colors. The separate "Queue"/"Topic Endpoint" sub-line is replaced by the badge.
- Below 720px the diagram scrolls horizontally instead of being squeezed until labels overlap.
- `SankeyChart` split: the edge pipeline (`buildDisplayEdges`) and SVG export (`exportSvg`) are
  now pure, unit-tested modules; the d3 link-id casts live in one documented helper.
- Server logs are now one JSON object per line (`timestamp`, `level`, `message`, `error`),
  which also prevents log forging via newlines in user-supplied values (CWE-117).
- `GET /api/endpoints` now returns `{ endpoints, errors }`. One unreachable broker no longer
  blanks a multi-broker diagram: the reachable ones are drawn and the UI warns about the rest.
  Only if every broker fails does the route still answer 502. (Breaking for API consumers.)

### Fixed
- Removing a Message VPN connection that the server refuses now shows the server's error on
  the connect screen instead of failing silently with an unhandled promise rejection.
- A failed refresh no longer closes the selection panel: the diagram inputs are derived once per
  endpoints reply (`lib/diagramData.ts`) instead of on every render of `App`, which also stops
  the layout from being recomputed on unrelated re-renders.
- The empty diagram no longer points at a source file that does not exist
  (`backend/src/semp/queries.ts`); it tells the user to refresh once an endpoint subscribes.
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
