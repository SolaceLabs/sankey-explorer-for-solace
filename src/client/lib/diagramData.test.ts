import { describe, expect, it } from "vitest";
import type { EndpointInfo } from "../types";
import { buildDiagramData } from "./diagramData";

const endpoint = (name: string, subscriptions: string[]): EndpointInfo => ({
  type: "queue",
  name,
  vpn: "default",
  subscriptions,
  brokerLabel: "default",
  brokerHost: "localhost:8080",
});

describe("buildDiagramData", () => {
  it("draws edges for subscribed endpoints and lists the unsubscribed ones by name", () => {
    const data = buildDiagramData([endpoint("orders-q", ["orders/created"]), endpoint("idle-q", [])]);
    expect(data.edges).toEqual([{ source: "orders/created", target: "Queue: orders-q", value: 1 }]);
    expect(data.unsubscribedEndpoints).toEqual(["idle-q"]);
  });

  it("is empty for no endpoints", () => {
    const data = buildDiagramData([]);
    expect(data.edges).toEqual([]);
    expect(data.unsubscribedEndpoints).toEqual([]);
    expect(data.endpointOwners.size).toBe(0);
  });
});
