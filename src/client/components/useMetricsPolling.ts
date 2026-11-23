import { useEffect, useReducer, useRef, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import type { MetricsResponse } from "../types";
import {
  initialMetricsPollingState,
  metricsPollingReducer,
  type MetricsPollingState,
  type PollIntervalMs,
} from "../lib/metricsPolling";

export type FetchMetrics = (signal: AbortSignal) => Promise<MetricsResponse>;

/** What the "Update automatically" choice can be: off, or one of the intervals. */
export type UpdateChoice = PollIntervalMs | "off";

export interface MetricsPolling {
  state: MetricsPollingState;
  start: () => void;
  pause: () => void;
  refreshNow: () => void;
  setIntervalMs: (intervalMs: PollIntervalMs) => void;
  /** "off" pauses; an interval sets it and starts polling (one choice, not switch + interval). */
  choose: (choice: UpdateChoice) => void;
}

const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === "AbortError";

/**
 * Live metrics polling. At most one request is in flight; the next one is
 * scheduled only after the previous finished (a setTimeout chain, never
 * setInterval), so a slow broker can't pile requests up. Pausing, a new
 * `resetKey` and unmounting abort the in-flight request and clear the
 * timer; a reply that arrives after that is dropped.
 *
 * `resetKey` identifies the loaded configuration: whenever it changes
 * (new configuration load, other brokers), polling pauses and every sample
 * is cleared until the user starts it again.
 */
export function useMetricsPolling(resetKey: number, fetchMetrics: FetchMetrics = api.getMetrics): MetricsPolling {
  const [state, dispatch] = useReducer(metricsPollingReducer, undefined, () => initialMetricsPollingState());
  const [seenResetKey, setSeenResetKey] = useState(resetKey);
  // Which fetchRequest the effect already served - see MetricsPollingState.fetchRequest.
  const servedRequest = useRef(0);
  // The fetcher is read through a ref so an inline function from the caller
  // doesn't restart the loop on every render.
  const fetchRef = useRef(fetchMetrics);
  useEffect(() => {
    fetchRef.current = fetchMetrics;
  }, [fetchMetrics]);

  // Reset during render rather than in an effect (React's "adjusting state
  // when a prop changes"): no extra render that still shows stale metrics.
  if (seenResetKey !== resetKey) {
    setSeenResetKey(resetKey);
    dispatch({ type: "reset" });
  }

  const { status, intervalMs, fetchRequest } = state;

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: AbortController | undefined;

    const poll = async () => {
      const controller = new AbortController();
      inFlight = controller;
      dispatch({ type: "fetchStarted" });
      try {
        const response = await fetchRef.current(controller.signal);
        if (disposed) return;
        dispatch({ type: "fetchSucceeded", response, at: Date.now() });
      } catch (err) {
        if (disposed || isAbort(err)) return;
        dispatch({ type: "fetchFailed", message: apiErrorMessage(err, "Could not load live metrics") });
      } finally {
        if (inFlight === controller) inFlight = undefined;
      }
      if (!disposed && status === "running") schedule();
    };
    const schedule = () => {
      timer = setTimeout(() => void poll(), intervalMs);
      dispatch({ type: "scheduled", at: Date.now() + intervalMs });
    };

    if (fetchRequest !== servedRequest.current) {
      servedRequest.current = fetchRequest;
      void poll();
    } else if (status === "running") {
      schedule();
    }

    return () => {
      disposed = true;
      clearTimeout(timer);
      if (inFlight) {
        inFlight.abort();
        dispatch({ type: "fetchCancelled" });
      }
    };
  }, [status, intervalMs, fetchRequest, seenResetKey]);

  return {
    state,
    start: () => dispatch({ type: "start" }),
    pause: () => dispatch({ type: "pause" }),
    refreshNow: () => dispatch({ type: "refreshNow" }),
    setIntervalMs: (ms) => dispatch({ type: "setInterval", intervalMs: ms }),
    choose: (choice) => {
      if (choice === "off") {
        dispatch({ type: "pause" });
        return;
      }
      dispatch({ type: "setInterval", intervalMs: choice });
      dispatch({ type: "start" });
    },
  };
}
