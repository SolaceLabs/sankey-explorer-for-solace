import { addWildcardCoverageEdges } from "../../shared/addWildcardCoverageEdges";
import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { explodeTopicHierarchy } from "./explodeTopicHierarchy";

/**
 * - "dataflow": the default. Includes implied wildcard-coverage edges (see
 *   addWildcardCoverageEdges) - a broader wildcard subscription shows up
 *   as also reaching a more specific topic subscribed elsewhere, since
 *   that's what the broker actually delivers.
 * - "subscriptions": literal mode. Only what's actually, individually
 *   declared on each endpoint - no wildcard-coverage edges at all, so the
 *   diagram matches the broker's raw subscription list 1:1.
 */
export type DiagramViewMode = "dataflow" | "subscriptions";

export interface DisplayEdgeOptions {
  viewMode: DiagramViewMode;
  showDirectSubscribers: boolean;
}

/**
 * The pure data pipeline behind the diagram: raw endpoint edges in, the
 * per-segment topic-hierarchy edges that get laid out out. Order matters:
 *
 * 1. Direct subscribers are dropped FIRST (ids prefixed "Direct Subscriber:"
 *    by toSankeyEdges), so wildcard coverage and exploding never see them and
 *    no orphaned direct-subscriber node can come back via an implied edge.
 * 2. Wildcard coverage runs BEFORE exploding - it compares full subscription
 *    strings against each other. Only in "dataflow" mode.
 * 3. Finally topics are exploded into their prefix chain.
 *
 * Selection (click-to-filter) is deliberately NOT part of this, so changing
 * the selected node doesn't recompute the expensive steps above.
 */
export function buildDisplayEdges(edges: SankeyEdge[], options: DisplayEdgeOptions): SankeyEdge[] {
  const visible = options.showDirectSubscribers
    ? edges
    : edges.filter(
        (e) =>
          !e.source.startsWith("Direct Subscriber:") && !e.target.startsWith("Direct Subscriber:"),
      );
  const withCoverage =
    options.viewMode === "dataflow" ? addWildcardCoverageEdges(visible) : visible;
  return explodeTopicHierarchy(withCoverage);
}
