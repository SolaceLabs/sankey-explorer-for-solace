import { describe, expect, it } from "vitest";
import { columnHeadings } from "./columnHeadings";

describe("columnHeadings", () => {
  it("numbers topic columns left to right and labels the endpoint column", () => {
    const nodes = [
      { id: "Queue: q1", x0: 600 },
      { id: "acme/sales", x0: 300 },
      { id: "acme", x0: 10 },
      { id: "acme/support", x0: 300 },
      { id: "Topic Endpoint: te1", x0: 600 },
    ];
    expect(columnHeadings(nodes)).toEqual([
      { x: 10, label: "Level 1" },
      { x: 300, label: "Level 2" },
      { x: 600, label: "Endpoints" },
    ]);
  });

  it("returns nothing for an empty graph", () => {
    expect(columnHeadings([])).toEqual([]);
  });

  it("skips nodes that have no layout position yet", () => {
    expect(columnHeadings([{ id: "acme", x0: undefined }])).toEqual([]);
  });
});
