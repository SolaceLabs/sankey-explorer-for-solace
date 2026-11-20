import type { SankeyEdge } from "../../shared/toSankeyEdges";

/** Node id -> its neighbour ids in one direction. */
export type Adjacency = ReadonlyMap<string, readonly string[]>;

/** Appends to the list under `key`, creating it on first use. */
export function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Every node id that appears in the edges, once, in first-seen order. */
export function nodeIdsOf(edges: readonly SankeyEdge[]): string[] {
  const ids = new Set<string>();
  for (const edge of edges) {
    ids.add(edge.source);
    ids.add(edge.target);
  }
  return [...ids];
}

/**
 * Neighbour lists for walking the flow downstream ("outgoing": topic towards
 * endpoint) or upstream ("incoming"). `include` drops edges from the walk -
 * e.g. implied wildcard-coverage edges when only declared subscriptions
 * should count.
 */
export function adjacencyOf(
  edges: readonly SankeyEdge[],
  direction: "outgoing" | "incoming",
  include: (edge: SankeyEdge) => boolean = () => true,
): Adjacency {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!include(edge)) continue;
    if (direction === "outgoing") appendTo(adjacency, edge.source, edge.target);
    else appendTo(adjacency, edge.target, edge.source);
  }
  return adjacency;
}

/** The start node plus every node reachable from it (breadth-first; safe on cycles). */
export function reachableFrom(start: string, adjacency: Adjacency): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  // for...of over an array also visits elements pushed during the loop.
  for (const current of queue) {
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}
