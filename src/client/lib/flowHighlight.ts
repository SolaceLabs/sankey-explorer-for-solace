import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { filterToRelevantSubgraph } from "./filterToRelevantSubgraph";
import { nodeIdsOf } from "./flowGraph";

/** What the diagram emphasises for one hovered or selected node. */
export interface FlowHighlight {
  edgeKeys: ReadonlySet<string>;
  nodeIds: ReadonlySet<string>;
}

/** A stable key for one source -> target edge. */
export const edgeKey = (source: string, target: string): string => `${source}\u0000${target}`;

/**
 * The flow through a node: what reaches it and what it reaches. In data
 * flow mode a wildcard endpoint's covered topics belong to its flow
 * (literal mode has no implied edges, so the option changes nothing there).
 * Highlighting and "Show only this" both use it, so they never disagree.
 */
export const flowThrough = (edges: SankeyEdge[], nodeId: string): SankeyEdge[] =>
  filterToRelevantSubgraph(edges, nodeId, { includeImpliedAncestors: true });

export const flowHighlight = (edges: SankeyEdge[], nodeId: string): FlowHighlight => {
  const flow = flowThrough(edges, nodeId);
  return {
    edgeKeys: new Set(flow.map((edge) => edgeKey(edge.source, edge.target))),
    nodeIds: new Set([nodeId, ...nodeIdsOf(flow)]),
  };
};
