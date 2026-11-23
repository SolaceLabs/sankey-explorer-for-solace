import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMetricsPolling, type FetchMetrics } from "./useMetricsPolling";
import { ApiRequestError } from "../api/client";
import type { MetricsResponse } from "../types";

const sample = (sampledAt: number): MetricsResponse => ({ sampledAt, metrics: [], errors: [] });

/** A fetcher whose calls stay pending until the test settles them; records each call's signal. */
function controllableFetcher() {
  const calls: { signal: AbortSignal; resolve: (r: MetricsResponse) => void; reject: (e: unknown) => void }[] = [];
  const fetcher = vi.fn<FetchMetrics>(
    (signal) =>
      new Promise((resolve, reject) => {
        calls.push({ signal, resolve, reject });
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  return { fetcher, calls };
}

const flush = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0);
});
const advance = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useMetricsPolling", () => {
  it("does nothing until started", async () => {
    const fetcher = vi.fn<FetchMetrics>().mockResolvedValue(sample(1));
    renderHook(() => useMetricsPolling(0, fetcher));

    await advance(60_000);

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches immediately on start, then every interval after the previous reply", async () => {
    const fetcher = vi.fn<FetchMetrics>().mockResolvedValue(sample(1));
    const { result } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.start());
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.state.current?.sampledAt).toBe(1);
    expect(result.current.state.lastSuccessAt).not.toBeNull();

    await advance(4_999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("never overlaps requests: a slow reply delays the next poll instead of stacking", async () => {
    const { fetcher, calls } = controllableFetcher();
    const { result } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.start());
    await advance(30_000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => calls[0]!.resolve(sample(1)));
    await advance(5_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good sample and shows the error when a poll fails, then keeps polling", async () => {
    const fetcher = vi
      .fn<FetchMetrics>()
      .mockResolvedValueOnce(sample(1))
      .mockRejectedValueOnce(new ApiRequestError("HTTP 503"))
      .mockResolvedValue(sample(3));
    const { result } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.start());
    await flush();
    await advance(5_000);

    expect(result.current.state.error).toBe("HTTP 503");
    expect(result.current.state.current?.sampledAt).toBe(1);

    await advance(5_000);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.current?.sampledAt).toBe(3);
  });

  it("pause aborts the in-flight request and stops the timer", async () => {
    const { fetcher, calls } = controllableFetcher();
    const { result } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.start());
    await flush();
    act(() => result.current.pause());
    await flush();

    expect(calls[0]!.signal.aborted).toBe(true);
    expect(result.current.state.isFetching).toBe(false);
    await advance(60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("'Refresh now' fetches once while paused without starting the loop", async () => {
    const fetcher = vi.fn<FetchMetrics>().mockResolvedValue(sample(7));
    const { result } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.refreshNow());
    await flush();
    await advance(60_000);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("paused");
    expect(result.current.state.current?.sampledAt).toBe(7);
  });

  it("a new resetKey pauses, clears the metrics and drops a reply that arrives late", async () => {
    const { fetcher, calls } = controllableFetcher();
    const { result, rerender } = renderHook(({ key }) => useMetricsPolling(key, fetcher), { initialProps: { key: 0 } });

    act(() => result.current.start());
    await flush();
    await act(async () => calls[0]!.resolve(sample(1)));
    expect(result.current.state.current).not.toBeNull();

    await advance(5_000); // second poll now in flight
    rerender({ key: 1 });
    await flush();

    expect(calls[1]!.signal.aborted).toBe(true);
    expect(result.current.state).toMatchObject({ status: "paused", current: null, previous: null, lastSuccessAt: null, error: null, isFetching: false });
    await advance(60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("can be started again after a reset", async () => {
    const fetcher = vi.fn<FetchMetrics>().mockResolvedValue(sample(1));
    const { result, rerender } = renderHook(({ key }) => useMetricsPolling(key, fetcher), { initialProps: { key: 0 } });

    act(() => result.current.start());
    await flush();
    rerender({ key: 1 });
    await flush();
    act(() => result.current.start());
    await flush();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe("running");
  });

  it("unmounting aborts the in-flight request and leaves no timer behind", async () => {
    const { fetcher, calls } = controllableFetcher();
    const { result, unmount } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.start());
    await flush();
    unmount();

    expect(calls[0]!.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("choosing an interval starts polling at that interval; choosing 'off' pauses", async () => {
    const fetcher = vi.fn<FetchMetrics>().mockResolvedValue(sample(1));
    const { result } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.choose(30_000));
    await flush();
    expect(result.current.state).toMatchObject({ status: "running", intervalMs: 30_000 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => result.current.choose("off"));
    await advance(60_000);
    expect(result.current.state.status).toBe("paused");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("knows when the next poll is due while running, and forgets it when paused", async () => {
    const fetcher = vi.fn<FetchMetrics>().mockResolvedValue(sample(1));
    const { result } = renderHook(() => useMetricsPolling(0, fetcher));

    act(() => result.current.start());
    await flush();
    expect(result.current.state.nextPollAt).toBe(Date.now() + 5_000);

    act(() => result.current.pause());
    await flush();
    expect(result.current.state.nextPollAt).toBeNull();
  });
});
