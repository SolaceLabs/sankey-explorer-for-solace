import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { computeSankeyLayout, type SortMode } from "../lib/sankeyLayout";
import { buildDisplayEdges, type DiagramViewMode } from "../lib/buildDisplayEdges";
import { downloadSvg } from "../lib/exportSvg";
import { describeSelection } from "../lib/describeSelection";
import { columnHeadings } from "../lib/columnHeadings";
import { nodeIdsOf } from "../lib/flowGraph";
import { flowHighlight, flowThrough } from "../lib/flowHighlight";
import { endpointSubLines } from "../lib/endpointSubLines";
import type { EndpointBrokerColors } from "../lib/buildEndpointBrokerColors";
import { isEndpointNode } from "../lib/nodeKind";
import { nodeFillColor } from "../lib/diagramColors";
import type { SankeyEdge } from "../../shared/toSankeyEdges";
import { activityTooltip, linkActivityOf, liveDetailsFor, type LiveMetricsView } from "../lib/liveMetricsView";
import { liveStatusLine } from "../lib/formatMetrics";
import type { ConsumerLookup } from "../types";
import { DiagramToolbar } from "./DiagramToolbar";
import { DiagramSearch } from "./DiagramSearch";
import { ExportSvgButton } from "./ExportSvgButton";
import { SelectionPanel } from "./SelectionPanel";
import { SankeyLinks } from "./SankeyLinks";
import { SankeyNode } from "./SankeyNode";
import { useDiagramSelection } from "./useDiagramSelection";
import { useElementWidth } from "./useElementWidth";

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
  /**
   * Live metrics overlay. `undefined`: the host has no live metrics at all;
   * `null`: it has, but no sample yet (or it was reset).
   */
  liveMetrics?: LiveMetricsView | null;
  /** The live metrics toolbar controls, rendered inside the diagram toolbar. */
  metricsControls?: ReactNode;
  /** Node id -> lookup key for the on-demand consumer list of queues/topic endpoints. */
  consumerLookups?: Map<string, ConsumerLookup>;
  /**
   * Bumped by the host to go back to the full overview: clears the
   * selection, "Show only this" and the search. View settings and live
   * metrics stay as they are.
   */
  overviewRequest?: number;
}

// Below this the columns and labels collide; narrower screens scroll the
// diagram horizontally instead of squeezing it.
const MIN_DIAGRAM_WIDTH = 720;
const MIN_DIAGRAM_HEIGHT = 420;
const HEIGHT_PER_NODE = 24;

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
  liveMetrics,
  metricsControls,
  consumerLookups,
  overviewRequest = 0,
}: SankeyChartProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = useElementWidth(canvasRef, 800);
  // A hovered LINK resolves to its target node id, not a separate
  // edge-shaped state - see filterToRelevantSubgraph's doc comment for why
  // hovering a connector and the block it leads into are identical.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("crossing");
  const [viewMode, setViewMode] = useState<DiagramViewMode>("dataflow");
  const [showDirectSubscribers, setShowDirectSubscribers] = useState(true);
  const { selection, select } = useDiagramSelection({ edges, viewMode, showDirectSubscribers });
  // Reset during render (React's "adjusting state when a prop changes"), so
  // no frame still shows the old selection.
  const [seenOverviewRequest, setSeenOverviewRequest] = useState(overviewRequest);
  if (seenOverviewRequest !== overviewRequest) {
    setSeenOverviewRequest(overviewRequest);
    select(null);
  }
  useEffect(() => {
    // Back to the overview also means back to its start: the left edge.
    if (canvasRef.current) canvasRef.current.scrollLeft = 0;
  }, [overviewRequest]);

  const explodedEdges = useMemo(
    () => buildDisplayEdges(edges, { viewMode, showDirectSubscribers }),
    [edges, viewMode, showDirectSubscribers],
  );
  const allNodeIds = useMemo(() => nodeIdsOf(explodedEdges), [explodedEdges]);

  const selectedId = selection?.nodeId ?? null;
  const isFocused = Boolean(selection?.focused);
  const displayEdges = useMemo(
    () => (isFocused && selectedId ? flowThrough(explodedEdges, selectedId) : explodedEdges),
    [explodedEdges, isFocused, selectedId],
  );
  const details = useMemo(
    () => (selectedId ? describeSelection(explodedEdges, selectedId) : null),
    [explodedEdges, selectedId],
  );

  const diagramWidth = Math.max(width, MIN_DIAGRAM_WIDTH);
  const height = Math.max(MIN_DIAGRAM_HEIGHT, nodeIdsOf(displayEdges).length * HEIGHT_PER_NODE);
  const vpnHosts = endpointBrokerColors && endpointBrokerColors.brokerCount > 1 ? endpointVpnHost : undefined;
  // A boolean, not the view itself: the layout must not recompute per poll.
  const showsMetricsLine = Boolean(liveMetrics);
  const graph = useMemo(
    () =>
      computeSankeyLayout(displayEdges, diagramWidth, height, sortMode, endpointOwners, endpointBrokerLabels, vpnHosts, showsMetricsLine),
    [displayEdges, diagramWidth, height, sortMode, endpointOwners, endpointBrokerLabels, vpnHosts, showsMetricsLine],
  );

  // Hover wins over the selection, so pointing at something else while a
  // panel is open still previews that flow.
  const highlightId = hoveredNodeId ?? selectedId;
  const highlight = useMemo(
    () => (highlightId ? flowHighlight(displayEdges, highlightId) : null),
    [displayEdges, highlightId],
  );

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
        No topic subscriptions found in the connected message VPNs. Once a
        queue, topic endpoint or client subscribes to a topic, refresh to see
        its flow here.
      </div>
    );
  }

  // Keyed by the overview request: going back to the overview also empties the search.
  const search = <DiagramSearch key={overviewRequest} nodeIds={allNodeIds} onFind={(id) => select(id)} />;
  const exportButton = (
    <ExportSvgButton onExport={() => svgRef.current && downloadSvg(svgRef.current, diagramWidth, height)} />
  );

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
        liveMetrics={metricsControls}
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
              <SankeyLinks
                links={graph.links}
                diagramWidth={diagramWidth}
                highlightedEdgeKeys={highlight?.edgeKeys ?? null}
                linkActivity={liveMetrics ? (targetId) => linkActivityOf(liveMetrics, targetId) : undefined}
                onHover={setHoveredNodeId}
                onSelect={(id) => select(id)}
              />
              <g>
                {graph.nodes.map((node) => {
                  const isEndpoint = isEndpointNode(node.id);
                  const metrics = liveMetrics?.byNodeId.get(node.id);
                  const activity = liveMetrics?.activity.get(node.id);
                  const staticLines = isEndpoint ? endpointSubLines(node.id, { owners: endpointOwners, vpnHosts }) : [];
                  return (
                    <SankeyNode
                      key={node.id}
                      node={node}
                      isEndpoint={isEndpoint}
                      isSelected={node.id === selectedId}
                      // Only a clicked selection dims the rest; hovering
                      // just adds the gradient to the hovered flow.
                      isDimmed={Boolean(!hoveredNodeId && highlight && !highlight.nodeIds.has(node.id))}
                      color={nodeFillColor(node.id, endpointBrokerColors)}
                      subLines={staticLines}
                      liveLine={metrics && activity ? liveStatusLine(metrics, activity) : null}
                      tooltipLines={activityTooltip(metrics, activity)}
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
            live={liveDetailsFor(liveMetrics, details.id)}
            consumerLookup={consumerLookups?.get(details.id)}
          />
        )}
      </div>
    </div>
  );
}
