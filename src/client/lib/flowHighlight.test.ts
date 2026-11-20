import { describe, expect, it } from "vitest";
import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { buildDisplayEdges } from "./buildDisplayEdges";
import { edgeKey, flowHighlight } from "./flowHighlight";

const raw: SankeyEdge[] = [
  { source: "retail/orders/>", target: "Queue: audit-q", value: 1 },
  { source: "retail/orders/created", target: "Queue: order-q", value: 1 },
  { source: "retail/inventory/updated", target: "Queue: stock-q", value: 1 },
];
const dataflow = buildDisplayEdges(raw, { viewMode: "dataflow", showDirectSubscribers: true });
const literal = buildDisplayEdges(raw, { viewMode: "subscriptions", showDirectSubscribers: true });

describe("edgeKey", () => {
  it("keeps source and target apart even when they share characters", () => {
    expect(edgeKey("a/b", "c")).not.toBe(edgeKey("a", "b/c"));
  });
});

describe("flowHighlight", () => {
  it("contains the node itself, everything upstream and everything downstream", () => {
    const { nodeIds } = flowHighlight(dataflow, "retail/orders");
    expect(nodeIds.has("retail/orders")).toBe(true);
    expect(nodeIds.has("retail")).toBe(true);
    expect(nodeIds.has("Queue: order-q")).toBe(true);
    expect(nodeIds.has("Queue: stock-q")).toBe(false);
  });

  it("includes topics a wildcard endpoint only covers in data flow mode", () => {
    expect(flowHighlight(dataflow, "Queue: audit-q").nodeIds.has("retail/orders/created")).toBe(true);
    expect(flowHighlight(literal, "Queue: audit-q").nodeIds.has("retail/orders/created")).toBe(false);
  });

  it("keys exactly the edges of the flow", () => {
    const { edgeKeys } = flowHighlight(literal, "Queue: stock-q");
    expect(edgeKeys.has(edgeKey("retail/inventory/updated", "Queue: stock-q"))).toBe(true);
    expect(edgeKeys.has(edgeKey("retail/orders/created", "Queue: order-q"))).toBe(false);
  });
});
