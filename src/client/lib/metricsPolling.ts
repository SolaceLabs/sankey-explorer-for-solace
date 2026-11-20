import type { MetricsResponse } from "../types";

/** Polling intervals offered in the toolbar, in ms. */
export const POLL_INTERVALS_MS = [5_000, 15_000, 30_000] as const;
export type PollIntervalMs = (typeof POLL_INTERVALS_MS)[number];
export const DEFAULT_POLL_INTERVAL_MS: PollIntervalMs = 5_000;

export interface MetricsPollingState {
  /** "running": a timer fetches every `intervalMs`; "paused": only manual refreshes. */
  status: "running" | "paused";
  intervalMs: PollIntervalMs;
  /** Latest successful sample - kept through failed polls, cleared by a reset. */
  current: MetricsResponse | null;
  /** The sample before `current`, for trends (e.g. a growing spool). */
  previous: MetricsResponse | null;
  /** Client time of the last successful sample. */
  lastSuccessAt: number | null;
  /** Message of the latest failed poll; cleared by the next success. */
  error: string | null;
  isFetching: boolean;
  /**
   * Increments for every request to fetch NOW (start, "Refresh now", a new
   * interval while running). The polling effect fetches immediately when it
   * sees a new value and otherwise only schedules the next poll. Never reset
   * to 0 - the effect compares it with the last value it served.
   */
  fetchRequest: number;
}

export type MetricsPollingAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "refreshNow" }
  | { type: "setInterval"; intervalMs: PollIntervalMs }
  | { type: "fetchStarted" }
  | { type: "fetchSucceeded"; response: MetricsResponse; at: number }
  | { type: "fetchFailed"; message: string }
  /** The in-flight request was aborted (pause, restart, reset) - no result will come. */
  | { type: "fetchCancelled" }
  | { type: "reset" };

export const initialMetricsPollingState = (intervalMs: PollIntervalMs = DEFAULT_POLL_INTERVAL_MS): MetricsPollingState => ({
  status: "paused",
  intervalMs,
  current: null,
  previous: null,
  lastSuccessAt: null,
  error: null,
  isFetching: false,
  fetchRequest: 0,
});

/** Pure state machine behind useMetricsPolling - all lifecycle rules live here. */
export function metricsPollingReducer(state: MetricsPollingState, action: MetricsPollingAction): MetricsPollingState {
  switch (action.type) {
    case "start":
      if (state.status === "running") return state;
      return { ...state, status: "running", fetchRequest: state.fetchRequest + 1 };
    case "pause":
      return state.status === "paused" ? state : { ...state, status: "paused" };
    case "refreshNow":
      return { ...state, fetchRequest: state.fetchRequest + 1 };
    case "setInterval":
      if (action.intervalMs === state.intervalMs) return state;
      // While running, the new cadence starts with a fresh sample right away.
      return {
        ...state,
        intervalMs: action.intervalMs,
        fetchRequest: state.status === "running" ? state.fetchRequest + 1 : state.fetchRequest,
      };
    case "fetchStarted":
      return { ...state, isFetching: true };
    case "fetchSucceeded":
      return {
        ...state,
        isFetching: false,
        previous: state.current,
        current: action.response,
        lastSuccessAt: action.at,
        error: null,
      };
    case "fetchFailed":
      // Keep the last good sample on screen: a transient error must not
      // blank the overlay.
      return { ...state, isFetching: false, error: action.message };
    case "fetchCancelled":
      return state.isFetching ? { ...state, isFetching: false } : state;
    case "reset":
      // New configuration: stop and forget every sample; keep the chosen
      // interval and the request counter (see fetchRequest).
      return { ...initialMetricsPollingState(state.intervalMs), fetchRequest: state.fetchRequest };
  }
}
