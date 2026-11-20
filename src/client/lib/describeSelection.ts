import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { subscriptionCovers } from "../../shared/subscriptionCovers";
import { endpointDisplayName } from "./endpointDisplayName";
import { isEndpointNode } from "./nodeKind";
import { adjacencyOf, appendTo, reachableFrom } from "./flowGraph";

/**
 * How a selected topic reaches an endpoint:
 * - "subscribed": the endpoint declares a subscription at or below the
 *   selected topic level (e.g. "retail/orders/created" itself, or
 *   "retail/orders/>" when "retail/orders" is selected).
 * - "covered": it only receives it through a broader wildcard declared
 *   elsewhere (an implied edge from addWildcardCoverageEdges).
 */
export type EndpointMatch = "subscribed" | "covered";

export interface ReachedEndpoint {
  id: string;
  match: EndpointMatch;
  /** The endpoint's own declared subscriptions that explain the match. */
  subscriptions: string[];
}

export type SelectionDetails =
  | {
      kind: "topic";
      id: string;
      /**
       * True for a branch (more topic levels below, e.g. "retail/orders"):
       * a single message reaches only some of its endpoints. False for a
       * full topic with nothing below, where every listed endpoint gets it.
       */
      hasSubtopics: boolean;
      endpoints: ReachedEndpoint[];
    }
  | { kind: "endpoint"; id: string; subscriptions: string[] };

/** Endpoint id -> its declared (non-implied) subscription strings. */
const declaredSubscriptions = (edges: SankeyEdge[]): Map<string, string[]> => {
  const declared = new Map<string, string[]>();
  for (const edge of edges) {
    // The last hop into an endpoint carries the full subscription string
    // as its source (see explodeTopicHierarchy); implied edges are
    // coverage, not something the endpoint declared.
    if (isEndpointNode(edge.target) && !edge.implied) appendTo(declared, edge.target, edge.source);
  }
  return declared;
};

const describeEndpoint = (
  endpointId: string,
  topicId: string,
  topicsBelow: Set<string>,
  declared: string[],
): ReachedEndpoint => {
  const own = declared.filter((sub) => topicsBelow.has(sub));
  if (own.length > 0) return { id: endpointId, match: "subscribed", subscriptions: own.sort() };
  const covering = declared.filter((sub) => subscriptionCovers(sub, topicId));
  return { id: endpointId, match: "covered", subscriptions: (covering.length ? covering : declared).sort() };
};

const bySubscribedThenName = (a: ReachedEndpoint, b: ReachedEndpoint): number => {
  if (a.match !== b.match) return a.match === "subscribed" ? -1 : 1;
  return endpointDisplayName(a.id).localeCompare(endpointDisplayName(b.id));
};

/**
 * What the selection panel says about a clicked node, derived from the
 * same display edges the diagram draws (so it can never disagree with
 * what is highlighted):
 * - a topic: every endpoint it reaches, and whether that is through the
 *   endpoint's own subscription or through wildcard coverage,
 * - an endpoint: its declared subscriptions.
 * Null if the node is not part of the graph (e.g. a stale selection).
 */
export function describeSelection(edges: SankeyEdge[], nodeId: string): SelectionDetails | null {
  const exists = edges.some((e) => e.source === nodeId || e.target === nodeId);
  if (!exists) return null;

  const outgoing = adjacencyOf(edges, "outgoing");
  const declared = declaredSubscriptions(edges);
  if (isEndpointNode(nodeId)) {
    return { kind: "endpoint", id: nodeId, subscriptions: [...(declared.get(nodeId) ?? [])].sort() };
  }

  const reachable = reachableFrom(nodeId, outgoing);
  const endpoints = [...reachable]
    .filter(isEndpointNode)
    .map((id) => describeEndpoint(id, nodeId, reachable, declared.get(id) ?? []))
    .sort(bySubscribedThenName);
  const hasSubtopics = (outgoing.get(nodeId) ?? []).some((next) => !isEndpointNode(next));
  return { kind: "topic", id: nodeId, hasSubtopics, endpoints };
}
