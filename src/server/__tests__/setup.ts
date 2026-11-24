import { vi } from "vitest";

// Runs before any test file is loaded. config.ts (imported by server.ts,
// imported by route tests) reads SESSION_SECRET from process.env at module
// load time - this has to be set before that happens, which a regular
// import-time assignment inside a test file is too late for (ES module
// imports are resolved before a file's own top-level code runs).
process.env.SESSION_SECRET ??= "test-secret-for-vitest-do-not-use-in-prod";
// The SEMP throttle's timing behavior is unit-tested in isolation
// (client.test.ts, with an explicit 0ms override) - the real 200ms default
// would just slow down every route test that touches a SempV2Client.
process.env.SEMP_MIN_REQUEST_INTERVAL_MS ??= "0";

// POST /api/connection resolves the broker hostname to check it isn't a
// link-local/metadata address (see brokerUrlPolicy.ts). Route tests use
// made-up hostnames, so answer every lookup with a harmless documentation
// address instead of hitting real DNS (slow, flaky, and network-dependent).
// A test that needs another answer overrides it per call:
//   vi.mocked(lookup).mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }] as never)
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(() => Promise.resolve([{ address: "192.0.2.10", family: 4 }])),
}));
