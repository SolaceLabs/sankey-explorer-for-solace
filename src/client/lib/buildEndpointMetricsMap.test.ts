import { describe, expect, it } from "vitest";
import { buildEndpointMetricsMap } from "./buildEndpointMetricsMap";
import { clientMetrics, endpointInfo, queueMetrics } from "./metricsFixtures";

describe("buildEndpointMetricsMap", () => {
  it("keys metrics by the same node id the diagram uses", () => {
    const map = buildEndpointMetricsMap(
      [endpointInfo(), endpointInfo({ type: "direct-subscriber", name: "app-1" })],
      [queueMetrics(), clientMetrics()],
    );

    expect([...map.keys()]).toEqual(["Queue: orders-q", "Direct Subscriber: app-1"]);
  });

  it("adds the broker suffix exactly when the diagram does (two or more brokers)", () => {
    const map = buildEndpointMetricsMap(
      [endpointInfo({ brokerLabel: "EU" }), endpointInfo({ brokerLabel: "US" })],
      [queueMetrics({ brokerLabel: "US", inbound: { current: 9, oneMinuteAverage: 9 } }), queueMetrics({ brokerLabel: "EU" })],
    );

    expect(map.get("Queue: orders-q (US)")?.inbound.current).toBe(9);
    expect(map.get("Queue: orders-q (EU)")?.inbound.current).toBe(0);
  });

  it("ignores metrics for objects the diagram does not draw, and leaves nodes without a sample out", () => {
    const map = buildEndpointMetricsMap(
      [endpointInfo(), endpointInfo({ type: "topic-endpoint", name: "te-gone" })],
      [queueMetrics(), clientMetrics({ name: "queue-consumer-only" })],
    );

    expect([...map.keys()]).toEqual(["Queue: orders-q"]);
  });

  it("does not confuse a queue and a topic endpoint of the same name", () => {
    const map = buildEndpointMetricsMap(
      [endpointInfo({ type: "topic-endpoint" })],
      [queueMetrics({ inbound: { current: 5, oneMinuteAverage: 5 } })],
    );

    expect(map.size).toBe(0);
  });
});
