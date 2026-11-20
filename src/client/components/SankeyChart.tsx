import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sankeyLinkHorizontal } from "d3-sankey";
import { computeSankeyLayout, resolvedLinkIds, type SortMode } from "../lib/sankeyLayout";
import { buildDisplayEdges, type DiagramViewMode } from "../lib/buildDisplayEdges";
import { downloadSvg } from "../lib/exportSvg";
import { filterToRelevantSubgraph } from "../lib/filterToRelevantSubgraph";
import { describeSelection } from "../lib/describeSelection";
import { columnHeadings } from "../lib/columnHeadings";
import { nodeIdsOf } from "../lib/flowGraph";
import type { EndpointBrokerColors } from "../lib/buildEndpointBrokerColors";
import { endpointTypeOf, isEndpointNode } from "../lib/nodeKind";
import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { DiagramToolbar } from "./DiagramToolbar";
import { DiagramSearch } from "./DiagramSearch";
import { ExportSvgButton } from "./ExportSvgButton";
import { SelectionPanel } from "./SelectionPanel";
import { SankeyNode } from "./SankeyNode";

interface SankeyChartProps {
  edges: SankeyEdge[];
  endpointOwners?: Map<string, string>;
  endpointBrokerColors?: EndpointBrokerColors;
  endpointBrokerLabels?: Map<string, string>;
  endpointVpnHost?: Map<string, string>;
  /** Names of endpoints without any subscription - counted in the toolbar. */
  unsubscribedEndpoints?: string[];
  /**
   * Where to render the search: an element in the app header (portal), so
   * it sits centered in the top bar while its state stays here, next to the
   * selection it drives. `undefined` renders it inline in the toolbar
   * (standalone use, tests); `null` means the slot is not mounted yet.
   */
  searchSlot?: HTMLElement | null;
  /** Where to render the export button - same contract as searchSlot. */
  exportSlot?: HTMLElement | null;
}

const FLOW_GRADIENT_ID = "sankey-flow-gradient";
// Below this the columns and labels collide; narrower screens scroll the
// diagram horizontally instead of squeezing it.
const MIN_DIAGRAM_WIDTH = 720;

// Solace Brand Book 2025 v3.0, p.17. Type colors match the Q / TE / DS
// badges (see SankeyNode, EndpointTypeBadge, index.css).
const TYPE_COLORS = { queue: "#00C895", topicEndpoint: "#C2F7FF", directSubscriber: "#FFFFFF" };

function nodeColor(id: string, brokerColors: EndpointBrokerColors | undefined): string {
  if (!isEndpointNode(id)) return "#C2F7FF"; // Secondary Light Blue - topic/hierarchy nodes

  // With 2+ brokers connected, color endpoints by broker instead of by
  // type - which broker an endpoint belongs to is the more useful signal
  // once several brokers are merged, and the badge still shows the type.
  if (brokerColors && brokerColors.brokerCount > 1) {
    const color = brokerColors.colorByEndpointLabel.get(id);
    if (color) return color;
  }

  const type = endpointTypeOf(id);
  if (type === "queue") return TYPE_COLORS.queue;
  if (type === "topic-endpoint") return TYPE_COLORS.topicEndpoint;
  return TYPE_COLORS.directSubscriber;
}

const edgeKey = (source: string, target: string): string => `${source}\u0000${target}`;

const linkPath = sankeyLinkHorizontal();

// Highlighting and "Show only this" follow what actually reaches a node:
// in data-flow mode a wildcard endpoint's covered topics belong to its flow.
// (Literal mode has no implied edges, so this changes nothing there.)
const FLOW_OPTIONS = { includeImpliedAncestors: true } as const;

interface Selection {
  nodeId: string;
  /** "Show only this": the diagram is reduced to the node's flow. */
  focused: boolean;
  // The context the selection was made in - see selectedNode below.
  edges: SankeyEdge[];
  viewMode: DiagramViewMode;
  showDirectSubscribers: boolean;
}

export type { DiagramViewMode };

export function SankeyChart({
  edges,
  endpointOwners,
  endpointBrokerColors,
  endpointBrokerLabels,
  endpointVpnHost,
  unsubscribedEndpoints = [],
  searchSlot,
  exportSlot,
}: SankeyChartProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [selection, setSelection] = useState<Selection | null>(null);
  // A hovered LINK resolves to its target node id, not a separate
  // edge-shaped state - see filterToRelevantSubgraph's doc comment for why
  // hovering a connector and the block it leads into are identical.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("crossing");
  const [viewMode, setViewMode] = useState<DiagramViewMode>("dataflow");
  const [showDirectSubscribers, setShowDirectSubscribers] = useState(true);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // New data, another view mode or toggling direct subscribers invalidate a
  // selection (its node may be gone). Derived during render instead of an
  // effect that resets it: no extra render with a stale selection.
  const selected =
    selection &&
    selection.edges === edges &&
    selection.viewMode === viewMode &&
    selection.showDirectSubscribers === showDirectSubscribers
      ? selection
      : null;
  const select = (nodeId: string | null, focused = false) =>
    setSelection(nodeId === null ? null : { nodeId, focused, edges, viewMode, showDirectSubscribers });

  const explodedEdges = useMemo(
    () => buildDisplayEdges(edges, { viewMode, showDirectSubscribers }),
    [edges, viewMode, showDirectSubscribers],
  );
  const allNodeIds = useMemo(() => nodeIdsOf(explodedEdges), [explodedEdges]);

  const selectedId = selected?.nodeId ?? null;
  const isFocused = Boolean(selected?.focused);
  const displayEdges = useMemo(
    () => (isFocused && selectedId ? filterToRelevantSubgraph(explodedEdges, selectedId, FLOW_OPTIONS) : explodedEdges),
    [explodedEdges, isFocused, selectedId],
  );
  const details = useMemo(
    () => (selectedId ? describeSelection(explodedEdges, selectedId) : null),
    [explodedEdges, selectedId],
  );

  const diagramWidth = Math.max(width, MIN_DIAGRAM_WIDTH);
  const height = Math.max(420, nodeIdsOf(displayEdges).length * 24);
  const showVpnHost = Boolean(endpointBrokerColors && endpointBrokerColors.brokerCount > 1);
  const graph = useMemo(
    () =>
      computeSankeyLayout(
        displayEdges,
        diagramWidth,
        height,
        sortMode,
        endpointOwners,
        endpointBrokerLabels,
        showVpnHost ? endpointVpnHost : undefined,
      ),
    [displayEdges, diagramWidth, height, sortMode, endpointOwners, endpointBrokerLabels, endpointVpnHost, showVpnHost],
  );

  // Hover wins over the selection, so pointing at something else while a
  // panel is open still previews that flow.
  const highlightId = hoveredNodeId ?? selectedId;
  const highlight = useMemo(() => {
    if (!highlightId) return null;
    const relevant = filterToRelevantSubgraph(displayEdges, highlightId, FLOW_OPTIONS);
    return {
      edgeKeys: new Set(relevant.map((e) => edgeKey(e.source, e.target))),
      nodeIds: new Set([highlightId, ...nodeIdsOf(relevant)]),
    };
  }, [displayEdges, highlightId]);

  const stats = useMemo(
    () => ({
      topics: allNodeIds.filter((id) => !isEndpointNode(id)).length,
      endpoints: allNodeIds.filter(isEndpointNode).length,
      unsubscribedEndpoints,
    }),
    [allNodeIds, unsubscribedEndpoints],
  );

  if (edges.length === 0) {
    return (
      <div className="sankey-empty">
        No topic subscriptions found - either no endpoint has any
        subscriptions, or the SEMP reply structure doesn't match the
        parser (see backend/src/semp/queries.ts).
      </div>
    );
  }

  const search = <DiagramSearch nodeIds={allNodeIds} onFind={(id) => select(id)} />;
  const exportButton = (
    <ExportSvgButton onExport={() => svgRef.current && downloadSvg(svgRef.current, diagramWidth, height)} />
  );
  const subLinesFor = (id: string): string[] => {
    const lines: string[] = [];
    const owner = endpointOwners?.get(id);
    if (owner) lines.push(owner);
    const vpnHost = showVpnHost ? endpointVpnHost?.get(id) : undefined;
    if (vpnHost) lines.push(vpnHost);
    return lines;
  };

  return (
    <div className="sankey-container">
      {searchSlot && createPortal(search, searchSlot)}
      {exportSlot && createPortal(exportButton, exportSlot)}
      <DiagramToolbar
        leading={searchSlot === undefined ? search : null}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showDirectSubscribers={showDirectSubscribers}
        onShowDirectSubscribersChange={setShowDirectSubscribers}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        stats={stats}
        isFocused={isFocused}
        onBackToOverview={() => select(selectedId, false)}
        trailing={exportSlot === undefined ? exportButton : null}
      />
      <div className="sankey-workspace">
        <div ref={canvasRef} className="sankey-canvas">
          <div className="sankey-stage" style={{ width: diagramWidth }}>
            <div className="sankey-columns" aria-hidden="true">
              {columnHeadings(graph.nodes).map((heading) => (
                <span key={heading.label} style={{ left: heading.x }}>
                  {heading.label}
                </span>
              ))}
            </div>
            <svg ref={svgRef} width={diagramWidth} height={height} role="img" aria-label="Topic to endpoint Sankey diagram">
              <defs>
                {/* Solace Brand Book 2025 v3.0, p.17, Gradient 16: Deep Green ->
                    Deep Blue. userSpaceOnUse (not the SVG default
                    objectBoundingBox) so this is ONE gradient spanning the whole
                    diagram width - every highlighted link samples its slice of
                    the same left-to-right sweep instead of restarting per link. */}
                <linearGradient id={FLOW_GRADIENT_ID} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={diagramWidth} y2={0}>
                  <stop offset="0%" stopColor="#009193" />
                  <stop offset="100%" stopColor="#093B5F" />
                </linearGradient>
              </defs>
              <g>
                {graph.links.map((link, i) => {
                  const d = linkPath(link as never);
                  if (!d) return null;
                  const { sourceId, targetId } = resolvedLinkIds(link);
                  // Only the highlighted flow changes; every other link keeps
                  // its normal look while something is hovered or selected.
                  const isHighlighted = highlight?.edgeKeys.has(edgeKey(sourceId, targetId));
                  const visualStrokeWidth = Math.max(1, link.width ?? 1);
                  return (
                    <g key={i}>
                      {/* Invisible, generously wide hit target; resolves to the
                          link's TARGET node, exactly like its block/label. */}
                      <path
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(14, visualStrokeWidth)}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoveredNodeId(targetId)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => select(targetId)}
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={isHighlighted ? `url(#${FLOW_GRADIENT_ID})` : "#C2F7FF"}
                        strokeOpacity={isHighlighted ? 0.75 : 0.2}
                        strokeWidth={visualStrokeWidth}
                        style={{ pointerEvents: "none" }}
                      />
                    </g>
                  );
                })}
              </g>
              <g>
                {graph.nodes.map((node) => {
                  const isEndpoint = isEndpointNode(node.id);
                  return (
                    <SankeyNode
                      key={node.id}
                      node={node}
                      isEndpoint={isEndpoint}
                      isSelected={node.id === selectedId}
                      // Only a clicked selection dims the rest; hovering
                      // just adds the gradient to the hovered flow.
                      isDimmed={Boolean(!hoveredNodeId && highlight && !highlight.nodeIds.has(node.id))}
                      color={nodeColor(node.id, endpointBrokerColors)}
                      subLines={isEndpoint ? subLinesFor(node.id) : []}
                      onHover={setHoveredNodeId}
                      onSelect={(id) => select(id)}
                    />
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
        {details && (
          <SelectionPanel
            details={details}
            isFocused={isFocused}
            onToggleFocus={() => select(details.id, !isFocused)}
            onClose={() => select(null)}
            endpointOwners={endpointOwners}
          />
        )}
      </div>
    </div>
  );
}
