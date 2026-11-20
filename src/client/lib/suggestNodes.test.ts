import { describe, expect, it } from "vitest";
import { suggestNodes } from "./suggestNodes";

const nodeIds = [
  "retail",
  "retail/orders",
  "retail/orders/created",
  "retail/orders/>",
  "retail/returns",
  "Queue: order-processing-q",
  "Queue: all-orders-audit-q (EU-Broker)",
  "Direct Subscriber: ops-dashboard",
];

describe("suggestNodes", () => {
  it("suggests nothing for an empty query", () => {
    expect(suggestNodes(nodeIds, "  ")).toEqual([]);
  });

  it("matches topic paths and bare endpoint names, case-insensitively", () => {
    expect(suggestNodes(nodeIds, "ORDER").map((s) => s.id)).toEqual([
      "Queue: order-processing-q",
      "retail/orders",
      "retail/orders/>",
      "retail/orders/created",
      "Queue: all-orders-audit-q (EU-Broker)",
    ]);
  });

  it("puts matches that start with the query first, then shorter ones", () => {
    expect(suggestNodes(nodeIds, "retail/r").map((s) => s.id)).toEqual(["retail/returns"]);
    expect(suggestNodes(nodeIds, "retail").map((s) => s.id).slice(0, 2)).toEqual([
      "retail",
      "retail/orders",
    ]);
  });

  it("returns the text to show: the full path for topics, the bare name for endpoints", () => {
    expect(suggestNodes(nodeIds, "dashboard")).toEqual([
      { id: "Direct Subscriber: ops-dashboard", label: "ops-dashboard", isEndpoint: true },
    ]);
    expect(suggestNodes(nodeIds, "created")).toEqual([
      { id: "retail/orders/created", label: "retail/orders/created", isEndpoint: false },
    ]);
  });

  it("caps the list", () => {
    expect(suggestNodes(nodeIds, "r", 3)).toHaveLength(3);
  });
});
