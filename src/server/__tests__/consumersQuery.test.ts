import { describe, expect, it } from "vitest";
import { parseConsumersQuery } from "../routes/consumersQuery.js";

describe("parseConsumersQuery", () => {
  it("accepts a queue or topic-endpoint lookup", () => {
    expect(parseConsumersQuery({ broker: "EU", type: "queue", name: "orders-q" })).toEqual({
      ok: true,
      value: { brokerLabel: "EU", type: "queue", name: "orders-q" },
    });
    expect(parseConsumersQuery({ broker: "EU", type: "topic-endpoint", name: "te" }).ok).toBe(true);
  });

  it.each([
    ["no query at all", undefined],
    ["a missing name", { broker: "EU", type: "queue" }],
    ["a blank broker", { broker: "  ", type: "queue", name: "q" }],
    ["a repeated key (array value)", { broker: "EU", type: "queue", name: ["a", "b"] }],
    ["an overlong name", { broker: "EU", type: "queue", name: "x".repeat(256) }],
    ["direct subscribers (they have no consumer flows)", { broker: "EU", type: "direct-subscriber", name: "c" }],
  ])("rejects %s", (_label, query) => {
    expect(parseConsumersQuery(query).ok).toBe(false);
  });
});
