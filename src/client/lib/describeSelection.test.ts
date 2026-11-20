import { describe, expect, it } from "vitest";
import { describeSelection } from "./describeSelection";
import { buildDisplayEdges } from "./buildDisplayEdges";
import type { SankeyEdge } from "../../shared/toSankeyEdges";

// The real pipeline output (exploded + wildcard coverage), so these tests
// exercise the same edge shape the diagram renders.
const raw: SankeyEdge[] = [
  { source: "retail/orders/>", target: "Queue: all-orders-audit-q", value: 1 },
  { source: "retail/orders/created", target: "Queue: order-processing-q", value: 1 },
  { source: "retail/inventory/updated", target: "Queue: inventory-sync-q", value: 1 },
];
const dataflow = buildDisplayEdges(raw, { viewMode: "dataflow", showDirectSubscribers: true });
const literal = buildDisplayEdges(raw, { viewMode: "subscriptions", showDirectSubscribers: true });

describe("describeSelection - topics", () => {
  it("lists the endpoint with a matching subscription as 'subscribed' and the wildcard one as 'covered'", () => {
    expect(describeSelection(dataflow, "retail/orders/created")).toEqual({
      kind: "topic",
      id: "retail/orders/created",
      hasSubtopics: false,
      endpoints: [
        {
          id: "Queue: order-processing-q",
          match: "subscribed",
          subscriptions: ["retail/orders/created"],
        },
        {
          id: "Queue: all-orders-audit-q",
          match: "covered",
          subscriptions: ["retail/orders/>"],
        },
      ],
    });
  });

  it("counts a wildcard subscription BELOW the selected level as 'subscribed'", () => {
    const details = describeSelection(dataflow, "retail/orders");
    expect(details?.kind).toBe("topic");
    if (details?.kind !== "topic") return;
    expect(details.endpoints.map((e) => [e.id, e.match])).toEqual([
      ["Queue: all-orders-audit-q", "subscribed"],
      ["Queue: order-processing-q", "subscribed"],
    ]);
  });

  it("does not list wildcard coverage in literal mode", () => {
    const details = describeSelection(literal, "retail/orders/created");
    expect(details?.kind === "topic" && details.endpoints.map((e) => e.id)).toEqual([
      "Queue: order-processing-q",
    ]);
  });

  it("tells a branch (more topic levels below) from a full topic (none below)", () => {
    const branch = describeSelection(dataflow, "retail/orders");
    const leaf = describeSelection(dataflow, "retail/orders/created");
    expect(branch?.kind === "topic" && branch.hasSubtopics).toBe(true);
    expect(leaf?.kind === "topic" && leaf.hasSubtopics).toBe(false);
  });

  it("does not leak endpoints from unrelated branches", () => {
    const details = describeSelection(dataflow, "retail/inventory");
    expect(details?.kind === "topic" && details.endpoints.map((e) => e.id)).toEqual([
      "Queue: inventory-sync-q",
    ]);
  });
});

describe("describeSelection - endpoints", () => {
  it("lists only the endpoint's own declared subscriptions, never implied coverage", () => {
    expect(describeSelection(dataflow, "Queue: all-orders-audit-q")).toEqual({
      kind: "endpoint",
      id: "Queue: all-orders-audit-q",
      subscriptions: ["retail/orders/>"],
    });
  });
});

describe("describeSelection - unknown nodes", () => {
  it("returns null for a node that is not in the graph", () => {
    expect(describeSelection(dataflow, "billing")).toBeNull();
  });
});
