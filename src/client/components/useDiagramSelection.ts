import { useState } from "react";
import type { SankeyEdge } from "../../shared/toSankeyEdges";
import type { DiagramViewMode } from "../lib/buildDisplayEdges";

/** Everything that decides which nodes exist in the diagram. */
export interface DiagramContext {
  edges: SankeyEdge[];
  viewMode: DiagramViewMode;
  showDirectSubscribers: boolean;
}

export interface DiagramSelection {
  nodeId: string;
  /** "Show only this": the diagram is reduced to the node's flow. */
  focused: boolean;
}

interface StoredSelection extends DiagramSelection {
  context: DiagramContext;
}

const sameContext = (a: DiagramContext, b: DiagramContext): boolean =>
  a.edges === b.edges && a.viewMode === b.viewMode && a.showDirectSubscribers === b.showDirectSubscribers;

/**
 * The clicked node. New data, another view mode or toggling direct
 * subscribers invalidate it (its node may be gone). That is derived during
 * render rather than reset in an effect: no extra render with a stale
 * selection.
 */
export function useDiagramSelection(context: DiagramContext) {
  const [stored, setStored] = useState<StoredSelection | null>(null);
  const selection: DiagramSelection | null = stored && sameContext(stored.context, context) ? stored : null;
  const select = (nodeId: string | null, focused = false) =>
    setStored(nodeId === null ? null : { nodeId, focused, context });
  return { selection, select };
}
