import { describe, expect, it } from "vitest";
import { initialMetricsPollingState, metricsPollingReducer, type MetricsPollingState } from "./metricsPolling";
import type { MetricsResponse } from "../types";

const sample = (sampledAt: number): MetricsResponse => ({ sampledAt, metrics: [], errors: [] });
const reduce = (state: MetricsPollingState, ...actions: Parameters<typeof metricsPollingReducer>[1][]) =>
  actions.reduce(metricsPollingReducer, state);

describe("metricsPollingReducer", () => {
  it("starts paused with no data", () => {
    const state = initialMetricsPollingState();
    expect(state).toMatchObject({ status: "paused", intervalMs: 5000, current: null, lastSuccessAt: null, error: null });
  });

  it("start requests an immediate fetch; starting twice requests only one", () => {
    const state = reduce(initialMetricsPollingState(), { type: "start" }, { type: "start" });
    expect(state.status).toBe("running");
    expect(state.fetchRequest).toBe(1);
  });

  it("keeps the previous sample for trends and clears the error on success", () => {
    const state = reduce(
      initialMetricsPollingState(),
      { type: "fetchSucceeded", response: sample(1), at: 100 },
      { type: "fetchFailed", message: "HTTP 503" },
      { type: "fetchSucceeded", response: sample(2), at: 200 },
    );
    expect(state.previous?.sampledAt).toBe(1);
    expect(state.current?.sampledAt).toBe(2);
    expect(state.lastSuccessAt).toBe(200);
    expect(state.error).toBeNull();
  });

  it("keeps the last good sample when a poll fails", () => {
    const state = reduce(
      initialMetricsPollingState(),
      { type: "fetchStarted" },
      { type: "fetchSucceeded", response: sample(1), at: 100 },
      { type: "fetchStarted" },
      { type: "fetchFailed", message: "broker unreachable" },
    );
    expect(state.current?.sampledAt).toBe(1);
    expect(state.lastSuccessAt).toBe(100);
    expect(state.error).toBe("broker unreachable");
    expect(state.isFetching).toBe(false);
  });

  it("changing the interval while running requests a fresh sample, while paused it does not", () => {
    const running = reduce(initialMetricsPollingState(), { type: "start" }, { type: "setInterval", intervalMs: 15000 });
    expect(running).toMatchObject({ intervalMs: 15000, fetchRequest: 2 });

    const paused = reduce(initialMetricsPollingState(), { type: "setInterval", intervalMs: 30000 });
    expect(paused).toMatchObject({ intervalMs: 30000, fetchRequest: 0 });
  });

  it("reset pauses and clears every sample but keeps the interval and the request counter", () => {
    const state = reduce(
      initialMetricsPollingState(),
      { type: "setInterval", intervalMs: 30000 },
      { type: "start" },
      { type: "fetchStarted" },
      { type: "fetchSucceeded", response: sample(1), at: 100 },
      { type: "fetchFailed", message: "x" },
      { type: "reset" },
    );
    expect(state).toEqual({ ...initialMetricsPollingState(30000), fetchRequest: 1 });
  });

  it("fetchCancelled only clears the fetching flag", () => {
    const fetching = reduce(initialMetricsPollingState(), { type: "fetchStarted" });
    expect(metricsPollingReducer(fetching, { type: "fetchCancelled" }).isFetching).toBe(false);
    const idle = initialMetricsPollingState();
    expect(metricsPollingReducer(idle, { type: "fetchCancelled" })).toBe(idle);
  });

  it("tracks the next scheduled poll and drops it on pause and when a fetch starts", () => {
    const scheduled = reduce(initialMetricsPollingState(), { type: "start" }, { type: "scheduled", at: 5000 });
    expect(scheduled.nextPollAt).toBe(5000);
    expect(metricsPollingReducer(scheduled, { type: "pause" }).nextPollAt).toBeNull();
    expect(metricsPollingReducer(scheduled, { type: "fetchStarted" }).nextPollAt).toBeNull();
  });
});
