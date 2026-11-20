import { describe, expect, it } from "vitest";
import { adjacencyOf, appendTo, nodeIdsOf, reachableFrom } from "./flowGraph";
import type { SankeyEdge } from "../../shared/toSankeyEdges";

const edges: SankeyEdge[] = [
  { source: "a", target: "a/b", value: 1 },
  { source: "a/b", target: "Queue: q1", value: 1 },
  { source: "a", target: "a/c", value: 1 },
  { source: "a/c", target: "Queue: q1", value: 1, implied: true },
];

describe("nodeIdsOf", () => {
  it("lists every node once, in first-seen order", () => {
    expect(nodeIdsOf(edges)).toEqual(["a", "a/b", "Queue: q1", "a/c"]);
  });
});

describe("appendTo", () => {
  it("creates the list on first use and appends afterwards", () => {
    const map = new Map<string, number[]>();
    appendTo(map, "x", 1);
    appendTo(map, "x", 2);
    expect(map.get("x")).toEqual([1, 2]);
  });
});

describe("adjacencyOf", () => {
  it("builds outgoing and incoming neighbour lists", () => {
    expect(adjacencyOf(edges, "outgoing").get("a")).toEqual(["a/b", "a/c"]);
    expect(adjacencyOf(edges, "incoming").get("Queue: q1")).toEqual(["a/b", "a/c"]);
  });

  it("only uses the edges the filter keeps", () => {
    const declared = adjacencyOf(edges, "incoming", (e) => !e.implied);
    expect(declared.get("Queue: q1")).toEqual(["a/b"]);
  });
});

describe("reachableFrom", () => {
  it("returns the start node and everything reachable from it", () => {
    const outgoing = adjacencyOf(edges, "outgoing");
    expect([...reachableFrom("a/b", outgoing)]).toEqual(["a/b", "Queue: q1"]);
    expect(reachableFrom("a", outgoing).size).toBe(4);
  });

  it("terminates on cycles", () => {
    const cyclic = adjacencyOf(
      [
        { source: "x", target: "y", value: 1 },
        { source: "y", target: "x", value: 1 },
      ],
      "outgoing",
    );
    expect([...reachableFrom("x", cyclic)]).toEqual(["x", "y"]);
  });
});
