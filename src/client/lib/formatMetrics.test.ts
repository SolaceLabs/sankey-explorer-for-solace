import { describe, expect, it } from "vitest";
import { LIVE_STATUS_LINE_TEMPLATE, formatBytes, formatPercent, formatRate, liveStatusLine } from "./formatMetrics";
import { classifyEndpointActivity } from "./endpointActivity";
import { clientMetrics, queueMetrics } from "./metricsFixtures";

describe("formatRate", () => {
  it.each([
    [null, "n/a"],
    [0, "0"],
    [42, "42"],
    [999.4, "999"],
    [999.6, "1.0k"],
    [1234, "1.2k"],
    [999_949, "999.9k"],
    [999_950, "1.0M"],
    [3_400_000, "3.4M"],
  ] as const)("%s -> %s", (value, expected) => expect(formatRate(value)).toBe(expected));
});

describe("formatBytes", () => {
  it.each([
    [null, "n/a"],
    [0, "0 B"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [3.25 * 1024 * 1024, "3.3 MB"],
  ] as const)("%s -> %s", (value, expected) => expect(formatBytes(value)).toBe(expected));
});

describe("formatPercent", () => {
  it("rounds and shows n/a without a ratio", () => {
    expect(formatPercent(0.456)).toBe("46%");
    expect(formatPercent(null)).toBe("n/a");
  });
});

describe("liveStatusLine", () => {
  const MB = 1024 * 1024;

  it("shows a flowing queue's in and out rates", () => {
    const metrics = queueMetrics({
      inbound: { current: 120, oneMinuteAverage: 100 },
      outbound: { current: 118, oneMinuteAverage: 90 },
      spool: { usageBytes: 2 * MB, quotaBytes: 100 * MB, unackedMsgCount: 2 },
    });
    expect(liveStatusLine(metrics, classifyEndpointActivity(metrics))).toEqual({
      status: "flowing",
      label: "Flowing",
      detail: "120/s in · 118/s out",
    });
  });

  it("explains why a queue is piling up: what waits, how full, and the trend", () => {
    const previous = queueMetrics({ spool: { usageBytes: 70 * MB, quotaBytes: 100 * MB, unackedMsgCount: 0 } });
    const metrics = queueMetrics({
      inbound: { current: 40, oneMinuteAverage: 40 },
      outbound: { current: 5, oneMinuteAverage: 5 },
      spool: { usageBytes: 80 * MB, quotaBytes: 100 * MB, unackedMsgCount: 0 },
    });
    expect(liveStatusLine(metrics, classifyEndpointActivity(metrics, previous))).toEqual({
      status: "piling-up",
      label: "Piling up",
      detail: "80.0 MB waiting · 80% full · growing",
    });
  });

  it("says 'nothing going out' for a stuck queue without a trend or quota", () => {
    const metrics = queueMetrics({ spool: { usageBytes: 2048, quotaBytes: null, unackedMsgCount: 0 } });
    expect(liveStatusLine(metrics, classifyEndpointActivity(metrics))?.detail).toBe("2.0 KB waiting · nothing going out");
  });

  it("shows only the word for idle, only the delivery rate for a direct subscriber, and nothing when unknown", () => {
    const idle = queueMetrics();
    expect(liveStatusLine(idle, classifyEndpointActivity(idle))).toEqual({ status: "idle", label: "Idle", detail: "" });

    const ds = clientMetrics({ inbound: { current: 7, oneMinuteAverage: 7 } });
    expect(liveStatusLine(ds, classifyEndpointActivity(ds))?.detail).toBe("7/s in");

    const blank = clientMetrics({ inbound: { current: null, oneMinuteAverage: null } });
    expect(liveStatusLine(blank, classifyEndpointActivity(blank))).toBeNull();
  });

  it("never produces a line wider than the template the layout reserves", () => {
    const metrics = queueMetrics({
      outbound: { current: 0, oneMinuteAverage: 0 },
      spool: { usageBytes: 1023.9 * MB, quotaBytes: 1024 * MB, unackedMsgCount: 0 },
    });
    const line = liveStatusLine(metrics, classifyEndpointActivity(metrics))!;
    expect(`${line.label}  ${line.detail}`.length).toBeLessThanOrEqual(LIVE_STATUS_LINE_TEMPLATE.length);
  });
});
