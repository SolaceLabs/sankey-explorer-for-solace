import { describe, expect, it } from "vitest";
import { BROKER_PALETTE, DIAGRAM_COLORS, ENDPOINT_TYPE_COLORS, RESERVED_COLORS, nodeFillColor } from "./diagramColors";

const oneBroker = { colorByEndpointLabel: new Map<string, string>(), brokerCount: 1 };
const twoBrokers = { colorByEndpointLabel: new Map([["Queue: q1", "#FFF7C2"]]), brokerCount: 2 };

describe("nodeFillColor", () => {
  it("fills topic nodes with the topic color", () => {
    expect(nodeFillColor("acme/sales", twoBrokers)).toBe(DIAGRAM_COLORS.topicNode);
  });

  it("colors endpoints by type with a single broker", () => {
    expect(nodeFillColor("Queue: q1", oneBroker)).toBe(ENDPOINT_TYPE_COLORS.queue);
    expect(nodeFillColor("Topic Endpoint: te1", undefined)).toBe(ENDPOINT_TYPE_COLORS["topic-endpoint"]);
    expect(nodeFillColor("Direct Subscriber: app", undefined)).toBe(ENDPOINT_TYPE_COLORS["direct-subscriber"]);
  });

  it("colors endpoints by broker once two or more brokers are connected", () => {
    expect(nodeFillColor("Queue: q1", twoBrokers)).toBe("#FFF7C2");
  });

  it("falls back to the type color for an endpoint missing from the broker map", () => {
    expect(nodeFillColor("Queue: unknown", twoBrokers)).toBe(ENDPOINT_TYPE_COLORS.queue);
  });
});

describe("BROKER_PALETTE", () => {
  it("shares no color with the reserved, meaning-carrying colors", () => {
    for (const color of BROKER_PALETTE) expect(RESERVED_COLORS).not.toContain(color);
  });
});
