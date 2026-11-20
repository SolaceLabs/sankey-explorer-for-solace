import { describe, expect, it } from "vitest";
import { METRICS_SUB_LINE_TEMPLATE, formatBytes, formatPercent, formatRate, metricsSubLine } from "./formatMetrics";
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

describe("metricsSubLine", () => {
  it("summarizes a queue's rates, spool and fill level", () => {
    const metrics = queueMetrics({
      inbound: { current: 120, oneMinuteAverage: 100 },
      outbound: { current: 80, oneMinuteAverage: 90 },
      spool: { usageBytes: 45 * 1024 * 1024, quotaBytes: 100 * 1024 * 1024, unackedMsgCount: 2 },
    });
    expect(metricsSubLine(metrics, classifyEndpointActivity(metrics))).toBe("in 120/s · out 80/s · 45.0 MB 45%");
  });

  it("marks a growing spool and copes with missing values", () => {
    const previous = queueMetrics({ spool: { usageBytes: 0, quotaBytes: null, unackedMsgCount: null } });
    const metrics = queueMetrics({
      inbound: { current: null, oneMinuteAverage: null },
      spool: { usageBytes: 2048, quotaBytes: null, unackedMsgCount: null },
    });
    expect(metricsSubLine(metrics, classifyEndpointActivity(metrics, previous))).toBe("in n/a/s · out 0/s · 2.0 KB ↑");
  });

  it("shows only the delivery rate for a direct subscriber", () => {
    const metrics = clientMetrics({ inbound: { current: 7, oneMinuteAverage: 7 } });
    expect(metricsSubLine(metrics, classifyEndpointActivity(metrics))).toBe("in 7/s");
  });

  it("never produces a line wider than the template the layout reserves", () => {
    const metrics = queueMetrics({
      inbound: { current: 999_949, oneMinuteAverage: null },
      outbound: { current: 999_949, oneMinuteAverage: null },
      spool: { usageBytes: 1023.9 * 1024 * 1024, quotaBytes: 1024 * 1024 * 1024, unackedMsgCount: 0 },
    });
    const previous = queueMetrics({ spool: { usageBytes: 0, quotaBytes: null, unackedMsgCount: 0 } });
    const line = metricsSubLine(metrics, classifyEndpointActivity(metrics, previous));
    expect(line.length).toBeLessThanOrEqual(METRICS_SUB_LINE_TEMPLATE.length);
  });
});
