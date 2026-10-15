import { describe, expect, it } from "vitest";
import { buildDisplayEdges } from "./buildDisplayEdges";
import type { SankeyEdge } from "../../shared/toSankeyEdges";

const edges: SankeyEdge[] = [
  { source: "acme/sales/>", target: "Queue: wildcard-q", value: 1 },
  { source: "acme/sales/orders", target: "Queue: specific-q", value: 1 },
  { source: "acme/sales/orders", target: "Direct Subscriber: app-1", value: 1 },
];

const nodesOf = (list: SankeyEdge[]) => new Set(list.flatMap((e) => [e.source, e.target]));

describe("buildDisplayEdges", () => {
  it("drops every edge touching a direct subscriber when they are hidden, before anything else runs", () => {
    const result = buildDisplayEdges(edges, { viewMode: "subscriptions", showDirectSubscribers: false });

    expect(nodesOf(result).has("Direct Subscriber: app-1")).toBe(false);
    expect(nodesOf(result).has("Queue: specific-q")).toBe(true);
  });

  it("keeps direct subscribers when shown", () => {
    const result = buildDisplayEdges(edges, { viewMode: "subscriptions", showDirectSubscribers: true });
    expect(nodesOf(result).has("Direct Subscriber: app-1")).toBe(true);
  });

  it("adds implied wildcard-coverage edges only in dataflow mode", () => {
    const dataflow = buildDisplayEdges(edges, { viewMode: "dataflow", showDirectSubscribers: true });
    const literal = buildDisplayEdges(edges, { viewMode: "subscriptions", showDirectSubscribers: true });

    expect(dataflow.some((e) => e.implied)).toBe(true);
    expect(literal.some((e) => e.implied)).toBe(false);
  });

  it("explodes topics into a per-segment hierarchy, summing the flows sharing a prefix edge", () => {
    const result = buildDisplayEdges(edges, { viewMode: "subscriptions", showDirectSubscribers: true });
    // All three subscriptions pass through acme -> acme/sales, so that edge carries value 3.
    expect(result).toEqual(
      expect.arrayContaining([{ source: "acme", target: "acme/sales", value: 3 }]),
    );
  });

  it("returns an empty list for no input", () => {
    expect(buildDisplayEdges([], { viewMode: "dataflow", showDirectSubscribers: true })).toEqual([]);
  });
});
