import { describe, expect, it } from "vitest";
import { activityTooltip, buildLiveMetricsView, linkActivityOf, liveDetailsFor, liveProblemText } from "./liveMetricsView";
import { classifyEndpointActivity } from "./endpointActivity";
import { clientMetrics, endpointInfo, queueMetrics } from "./metricsFixtures";
import type { MetricsResponse } from "../types";

const MB = 1024 * 1024;
const response = (metrics: MetricsResponse["metrics"], sampledAt = 1): MetricsResponse => ({ sampledAt, metrics, errors: [] });

describe("buildLiveMetricsView", () => {
  it("is null before the first sample", () => {
    expect(buildLiveMetricsView([endpointInfo()], null, null)).toBeNull();
  });

  it("classifies every mapped node against its previous sample", () => {
    const previous = response([queueMetrics({ spool: { usageBytes: 1 * MB, quotaBytes: null, unackedMsgCount: 0 } })]);
    const current = response([queueMetrics({ outbound: { current: 5, oneMinuteAverage: 5 }, spool: { usageBytes: 2 * MB, quotaBytes: null, unackedMsgCount: 0 } })], 9);

    const view = buildLiveMetricsView([endpointInfo()], current, previous);

    expect(view?.sampledAt).toBe(9);
    expect(view?.activity.get("Queue: orders-q")).toMatchObject({ status: "piling-up", trend: "growing" });
  });
});

describe("linkActivityOf", () => {
  const view = buildLiveMetricsView(
    [endpointInfo(), endpointInfo({ type: "direct-subscriber", name: "app-1" }), endpointInfo({ name: "no-sample-q" })],
    response([queueMetrics({ inbound: { current: 3, oneMinuteAverage: 3 } }), clientMetrics()]),
    null,
  );

  it("marks links into receiving endpoints as flowing and links into known-quiet ones idle", () => {
    expect(linkActivityOf(view, "Queue: orders-q")).toBe("flowing");
    expect(linkActivityOf(view, "Direct Subscriber: app-1")).toBe("idle");
  });

  it("says nothing for links into endpoints without a sample, topic levels, or before any sample", () => {
    expect(linkActivityOf(view, "Queue: no-sample-q")).toBeNull();
    expect(linkActivityOf(view, "orders")).toBeNull();
    expect(linkActivityOf(null, "Queue: orders-q")).toBeNull();
  });
});

describe("activityTooltip", () => {
  it("spells out status, rates and spool for a queue", () => {
    const metrics = queueMetrics({
      inbound: { current: 12, oneMinuteAverage: 12 },
      outbound: { current: 10, oneMinuteAverage: 10 },
      spool: { usageBytes: 50 * MB, quotaBytes: 100 * MB, unackedMsgCount: 0 },
    });
    expect(activityTooltip(metrics, classifyEndpointActivity(metrics))).toEqual([
      "Live: Flowing",
      "In: 12 msg/s",
      "Out: 10 msg/s",
      "Spool: 50.0 MB (50% of quota)",
    ]);
  });

  it("adds the spool trend even without a quota", () => {
    const previous = queueMetrics({ spool: { usageBytes: 0, quotaBytes: null, unackedMsgCount: 0 } });
    const metrics = queueMetrics({ spool: { usageBytes: 2048, quotaBytes: null, unackedMsgCount: 0 } });
    expect(activityTooltip(metrics, classifyEndpointActivity(metrics, previous)).at(-1)).toBe("Spool: 2.0 KB (growing)");
  });

  it("is empty without metrics and short for a direct subscriber", () => {
    expect(activityTooltip(undefined, undefined)).toEqual([]);
    const ds = clientMetrics();
    expect(activityTooltip(ds, classifyEndpointActivity(ds))).toEqual(["Live: Idle", "In: 0 msg/s"]);
  });
});

describe("liveDetailsFor", () => {
  it("distinguishes 'no overlay', 'no sample yet' and a node's data", () => {
    expect(liveDetailsFor(undefined, "Queue: orders-q")).toBeUndefined();
    expect(liveDetailsFor(null, "Queue: orders-q")).toEqual({ hasSample: false, metrics: undefined, activity: undefined });
    const view = buildLiveMetricsView([endpointInfo()], response([queueMetrics()]), null);
    expect(liveDetailsFor(view, "Queue: orders-q")).toMatchObject({ hasSample: true, metrics: { name: "orders-q" }, activity: { status: "idle" } });
  });
});

describe("liveProblemText", () => {
  it("is null when the last poll worked for every broker", () => {
    expect(liveProblemText({ error: null, current: response([]) })).toBeNull();
  });

  it("names the failed poll and the brokers missing from the last good sample", () => {
    const current = { ...response([]), errors: [{ brokerLabel: "EU", message: "HTTP 503" }] };
    expect(liveProblemText({ error: "broker unreachable", current })).toBe(
      "Last poll failed: broker unreachable. No metrics from EU (HTTP 503)",
    );
  });
});
