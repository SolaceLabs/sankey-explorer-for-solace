import { describe, expect, it } from "vitest";
import { findNodeByQuery } from "./findNodeByQuery";

const nodeIds = [
  "retail",
  "retail/orders",
  "retail/orders/created",
  "retail/orders/>",
  "retail/order-archive",
  "Queue: order-processing-q",
  "Queue: all-orders-audit-q (EU-Broker)",
  "Direct Subscriber: ops-dashboard",
];

describe("findNodeByQuery", () => {
  it("returns null for an empty or whitespace-only query", () => {
    expect(findNodeByQuery(nodeIds, "")).toBeNull();
    expect(findNodeByQuery(nodeIds, "   ")).toBeNull();
  });

  it("matches a full topic path exactly, ignoring case and surrounding spaces", () => {
    expect(findNodeByQuery(nodeIds, " Retail/Orders/Created ")).toBe("retail/orders/created");
  });

  it("matches a literal wildcard node when the query is that exact subscription", () => {
    expect(findNodeByQuery(nodeIds, "retail/orders/>")).toBe("retail/orders/>");
  });

  it("treats a trailing '/*' as 'this topic level' when no node has that literal id", () => {
    expect(findNodeByQuery(nodeIds, "retail/orders/*")).toBe("retail/orders");
  });

  it("matches an endpoint by its bare name, without type prefix or broker suffix", () => {
    expect(findNodeByQuery(nodeIds, "all-orders-audit-q")).toBe(
      "Queue: all-orders-audit-q (EU-Broker)",
    );
    expect(findNodeByQuery(nodeIds, "OPS-DASHBOARD")).toBe("Direct Subscriber: ops-dashboard");
  });

  it("falls back to a partial match, preferring topics that start with the query", () => {
    expect(findNodeByQuery(nodeIds, "retail/ord")).toBe("retail/orders");
  });

  it("falls back to a partial endpoint-name match", () => {
    expect(findNodeByQuery(nodeIds, "processing")).toBe("Queue: order-processing-q");
  });

  it("returns null when nothing matches", () => {
    expect(findNodeByQuery(nodeIds, "billing")).toBeNull();
  });
});
