import { describe, expect, it } from "vitest";
import { classifyAll, classifyEndpointActivity, effectiveRate, spoolTrend } from "./endpointActivity";
import { clientMetrics, queueMetrics } from "./metricsFixtures";

const MB = 1024 * 1024;
const rate = (current: number | null, oneMinuteAverage: number | null = current) => ({ current, oneMinuteAverage });

describe("effectiveRate", () => {
  it("prefers the instantaneous rate and falls back to the 1-minute average", () => {
    expect(effectiveRate(rate(3, 9))).toBe(3);
    expect(effectiveRate(rate(null, 9))).toBe(9);
    expect(effectiveRate(rate(null, null))).toBeNull();
  });
});

describe("spoolTrend", () => {
  it.each([
    [10, 5, "growing"],
    [5, 10, "shrinking"],
    [5, 5, "steady"],
    [5, undefined, "unknown"],
    [null, 5, "unknown"],
  ] as const)("%s after %s is %s", (current, previous, expected) => {
    expect(spoolTrend(current, previous)).toBe(expected);
  });
});

describe("classifyEndpointActivity", () => {
  it("is 'unknown' without a sample", () => {
    expect(classifyEndpointActivity(undefined).status).toBe("unknown");
  });

  it("is 'unknown' when the broker reported no rates and no spool usage", () => {
    const blank = queueMetrics({ inbound: rate(null), outbound: rate(null), spool: { usageBytes: null, quotaBytes: null, unackedMsgCount: null } });
    expect(classifyEndpointActivity(blank).status).toBe("unknown");
    expect(classifyEndpointActivity(clientMetrics({ inbound: rate(null) })).status).toBe("unknown");
  });

  it("treats real zeros as 'idle', not 'unknown'", () => {
    expect(classifyEndpointActivity(queueMetrics()).status).toBe("idle");
    expect(classifyEndpointActivity(clientMetrics()).status).toBe("idle");
  });

  it("is 'flowing' while messages flow through and the spool drains", () => {
    const activity = classifyEndpointActivity(queueMetrics({ inbound: rate(50), outbound: rate(50) }));
    expect(activity).toMatchObject({ status: "flowing", receiving: true });
    expect(classifyEndpointActivity(clientMetrics({ inbound: rate(4) })).status).toBe("flowing");
  });

  it("flags a growing spool as 'piling up' even while consumers are draining it", () => {
    const previous = queueMetrics({ spool: { usageBytes: 1 * MB, quotaBytes: 100 * MB, unackedMsgCount: 0 } });
    const current = queueMetrics({ inbound: rate(80), outbound: rate(50), spool: { usageBytes: 2 * MB, quotaBytes: 100 * MB, unackedMsgCount: 0 } });

    expect(classifyEndpointActivity(current, previous)).toMatchObject({ status: "piling-up", trend: "growing", fillRatio: 0.02 });
  });

  it("flags spooled messages that nothing is consuming as 'piling up'", () => {
    const stuck = queueMetrics({ spool: { usageBytes: 512, quotaBytes: 100 * MB, unackedMsgCount: 0 } });
    expect(classifyEndpointActivity(stuck).status).toBe("piling-up");
  });

  it("flags a spool at 80% or more of its quota as 'piling up' even when shrinking", () => {
    const previous = queueMetrics({ spool: { usageBytes: 90 * MB, quotaBytes: 100 * MB, unackedMsgCount: 0 } });
    const current = queueMetrics({ outbound: rate(100), spool: { usageBytes: 85 * MB, quotaBytes: 100 * MB, unackedMsgCount: 0 } });

    expect(classifyEndpointActivity(current, previous)).toMatchObject({ status: "piling-up", trend: "shrinking" });
  });

  it("has no fill level without a quota", () => {
    const noQuota = queueMetrics({ outbound: rate(1), spool: { usageBytes: 10, quotaBytes: null, unackedMsgCount: 0 } });
    expect(classifyEndpointActivity(noQuota).fillRatio).toBeNull();
  });
});

describe("classifyAll", () => {
  it("compares each node only with its own previous sample", () => {
    const previous = new Map([["Queue: a", queueMetrics({ name: "a", spool: { usageBytes: 10, quotaBytes: null, unackedMsgCount: 0 } })]]);
    const current = new Map([
      ["Queue: a", queueMetrics({ name: "a", outbound: rate(1), spool: { usageBytes: 5, quotaBytes: null, unackedMsgCount: 0 } })],
      ["Queue: b", queueMetrics({ name: "b" })],
    ]);

    const result = classifyAll(current, previous);

    expect(result.get("Queue: a")?.trend).toBe("shrinking");
    expect(result.get("Queue: b")?.trend).toBe("unknown");
  });
});
