import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { adjacencyOf, nodeIdsOf } from "./flowGraph";

/**
 * For every node, computes a sort key derived from the endpoint(s) it
 * ultimately reaches: an endpoint (a sink - no outgoing edges) uses
 * `endpointKey(id)` (defaults to its own id, i.e. "sort by queue name").
 * A topic node uses the alphabetically smallest key among the endpoints
 * reachable via its outgoing edges (recursively). This lets topic branches
 * that ultimately feed the same queue - or the same owner, if `endpointKey`
 * looks that up - cluster together when sorted, instead of by their own
 * topic string.
 *
 * Expects an already-acyclic edge list (run removeCycles first) - a real
 * cycle would make "reachable endpoint" ill-defined and this function
 * would recurse forever.
 */
export function buildQueueSortKeys(
  edges: SankeyEdge[],
  endpointKey: (endpointId: string) => string = (id) => id,
): Map<string, string> {
  const outgoing = adjacencyOf(edges, "outgoing");
  const memo = new Map<string, string>();

  function keyFor(id: string): string {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;

    const children = outgoing.get(id);
    if (!children || children.length === 0) {
      // Sink node - it IS an endpoint.
      const key = endpointKey(id);
      memo.set(id, key);
      return key;
    }

    // children is non-empty here, so the reduce always has a first value.
    const smallest = children.map(keyFor).reduce((a, b) => (b < a ? b : a));
    memo.set(id, smallest);
    return smallest;
  }

  for (const id of nodeIdsOf(edges)) keyFor(id);
  return memo;
}
