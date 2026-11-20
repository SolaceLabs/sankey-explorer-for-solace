import { describe, expect, it } from "vitest";
import { ENDPOINT_TYPE_LABELS, endpointTypeOfNodeId, stripEndpointTypePrefix } from "./endpointNodeId.js";
import { endpointLabel } from "./toSankeyEdges.js";
import type { EndpointType } from "./types.js";

const TYPES = Object.keys(ENDPOINT_TYPE_LABELS) as EndpointType[];

describe("endpointTypeOfNodeId", () => {
  it("reads back the type of every id endpointLabel produces, with or without broker suffix", () => {
    for (const type of TYPES) {
      const endpoint = { type, name: "orders-q", brokerLabel: "EU-Broker" };
      expect(endpointTypeOfNodeId(endpointLabel(endpoint, false))).toBe(type);
      expect(endpointTypeOfNodeId(endpointLabel(endpoint, true))).toBe(type);
    }
  });

  it("returns null for topic hierarchy ids", () => {
    expect(endpointTypeOfNodeId("acme/sales")).toBeNull();
    expect(endpointTypeOfNodeId("Queue")).toBeNull();
    expect(endpointTypeOfNodeId("")).toBeNull();
  });
});

describe("stripEndpointTypePrefix", () => {
  it("removes the type prefix and keeps everything else", () => {
    expect(stripEndpointTypePrefix("Topic Endpoint: te-orders (EU-Broker)")).toBe("te-orders (EU-Broker)");
    expect(stripEndpointTypePrefix("Direct Subscriber: my-app-1")).toBe("my-app-1");
  });

  it("leaves topic ids untouched", () => {
    expect(stripEndpointTypePrefix("acme/sales")).toBe("acme/sales");
  });
});
