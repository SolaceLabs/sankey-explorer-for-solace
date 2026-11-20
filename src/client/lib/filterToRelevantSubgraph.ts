import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { adjacencyOf, reachableFrom } from "./flowGraph";

export interface RelevantSubgraphOptions {
  /**
   * Also walk implied wildcard-coverage edges upwards. Off by default: the
   * ancestor view then answers "what did this endpoint literally subscribe
   * to". On, it answers "which topics actually reach this endpoint" - what
   * the data-flow view highlights on hover/selection, so a "retail/orders/>"
   * queue lights up "retail/orders/created" too.
   */
  includeImpliedAncestors?: boolean;
}

/**
 * Reduces the graph to the part connected to `selectedNodeId`: all
 * ancestors (the path leading there, e.g. the topic hierarchy up to the
 * root) AND all descendants (everything reachable from there, e.g. the
 * queues/topic-endpoints that receive this subscription).
 *
 * This covers all three UI interactions with the same logic:
 * - Click/hover a queue (has no outgoing edges) -> only ancestors come
 *   back = "which subscriptions land here".
 * - Click/hover a topic/segment -> ancestors (its place in the tree) AND
 *   descendants (which queues/topic-endpoints it reaches).
 * - Click/hover the connecting LINK between two levels -> the caller
 *   passes that link's TARGET node id here. In a tree (every node has
 *   exactly one parent), ancestors-of-target already equals
 *   ancestors-of-source + source itself, so this gives the exact same
 *   result as hovering/clicking the node the link points into - by
 *   construction, not by coincidence, which is what guarantees hovering a
 *   connector and hovering the block/text it leads to are always identical.
 */
export function filterToRelevantSubgraph(
  edges: SankeyEdge[],
  selectedNodeId: string,
  options: RelevantSubgraphOptions = {},
): SankeyEdge[] {
  const nodeExists = edges.some(
    (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId,
  );
  if (!nodeExists) return [];

  // Ancestors ("what is this node actually reached from") are only real
  // subscriptions by default: an implied wildcard-coverage edge (see
  // addWildcardCoverageEdges) must not make it look like a queue literally
  // subscribed to a topic it never declared. Implied edges always count
  // downstream, so the covered topic itself still shows the queue that
  // reaches it via the wildcard.
  const includeImplied = options.includeImpliedAncestors ?? false;
  const outgoing = adjacencyOf(edges, "outgoing");
  const incoming = adjacencyOf(edges, "incoming", (edge) => includeImplied || !edge.implied);
  const descendants = reachableFrom(selectedNodeId, outgoing);
  const ancestors = reachableFrom(selectedNodeId, incoming);
  const relevantNodes = new Set([...descendants, ...ancestors]);

  return edges.filter(
    (edge) => relevantNodes.has(edge.source) && relevantNodes.has(edge.target),
  );
}
