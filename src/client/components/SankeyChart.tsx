import { useEffect, useMemo, useRef, useState } from "react";
import { sankeyLinkHorizontal } from "d3-sankey";
import { computeSankeyLayout, resolvedLinkIds, type SortMode } from "../lib/sankeyLayout";
import { buildDisplayEdges, type DiagramViewMode } from "../lib/buildDisplayEdges";
import { downloadSvg } from "../lib/exportSvg";
import { nodeDisplayLabel } from "../lib/nodeDisplayLabel";
import { endpointDisplayName } from "../lib/endpointDisplayName";
import { filterToRelevantSubgraph } from "../lib/filterToRelevantSubgraph";
import type { EndpointBrokerColors } from "../lib/buildEndpointBrokerColors";
import { endpointTypeLabel, isEndpointNode } from "../lib/nodeKind";
import type { SankeyEdge } from "../../shared/toSankeyEdges";

interface SankeyChartProps {
  edges: SankeyEdge[];
  endpointOwners?: Map<string, string>;
  endpointBrokerColors?: EndpointBrokerColors;
  endpointBrokerLabels?: Map<string, string>;
  endpointVpnHost?: Map<string, string>;
}

const FLOW_GRADIENT_ID = "sankey-flow-gradient";

// Solace Brand Book 2025 v3.0, p.17 (Primary/Secondary Color Palette).
function nodeColor(id: string, brokerColors: EndpointBrokerColors | undefined): string {
  if (!isEndpointNode(id)) return "#C2F7FF"; // Secondary Light Blue - topic/hierarchy nodes

  // With 2+ brokers connected, color endpoints by broker instead of by
  // type - which broker an endpoint belongs to is the more useful signal
  // once you're merging several brokers' worth of data. With just one
  // broker, broker color would be meaningless (every endpoint the same
  // color), so fall back to the original type-based coloring.
  if (brokerColors && brokerColors.brokerCount > 1) {
    const color = brokerColors.colorByEndpointLabel.get(id);
    if (color) return color;
  }

  if (id.startsWith("Queue:")) return "#00C895"; // Classic Green - 01
  if (id.startsWith("Topic Endpoint:")) return "#FCA829"; // Secondary Orange
  return "#FFF7C2"; // Secondary Sunrise Yellow - Direct Subscriber
}

function edgeKey(source: string, target: string): string {
  return `${source}\u0000${target}`;
}

const linkPath = sankeyLinkHorizontal();

export type { DiagramViewMode };

export function SankeyChart({
  edges,
  endpointOwners,
  endpointBrokerColors,
  endpointBrokerLabels,
  endpointVpnHost,
}: SankeyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  // The selection remembers which data/mode it was made in; it only counts
  // while that context is unchanged. Derived during render (instead of an
  // effect that resets it) so there is no extra render with a stale
  // selection, and no setState-in-effect.
  const [selection, setSelection] = useState<{
    nodeId: string;
    edges: SankeyEdge[];
    viewMode: DiagramViewMode;
    showDirectSubscribers: boolean;
  } | null>(null);
  // A hovered LINK resolves to its target node id here, not a separate
  // edge-shaped state - see filterToRelevantSubgraph's doc comment for why
  // that guarantees hovering/clicking a connector and the block/text it
  // leads into are always exactly the same, by construction.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("crossing");
  const [viewMode, setViewMode] = useState<DiagramViewMode>("dataflow");
  const [showDirectSubscribers, setShowDirectSubscribers] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // New data (reconnect/refresh), switching view mode, or toggling direct
  // subscribers invalidate a selection: its node may no longer exist (e.g. a
  // node only reachable via an implied wildcard edge disappears when
  // switching from "dataflow" to "subscriptions"; a direct-subscriber node
  // disappears when that toggle is switched off).
  const selectedNodeId =
    selection &&
    selection.edges === edges &&
    selection.viewMode === viewMode &&
    selection.showDirectSubscribers === showDirectSubscribers
      ? selection.nodeId
      : null;
  function setSelectedNodeId(nodeId: string | null) {
    setSelection(nodeId === null ? null : { nodeId, edges, viewMode, showDirectSubscribers });
  }

  // Raw edges -> hierarchy edges (see buildDisplayEdges for the order of steps).
  const explodedEdges = useMemo(
    () => buildDisplayEdges(edges, { viewMode, showDirectSubscribers }),
    [edges, viewMode, showDirectSubscribers],
  );

  const displayEdges = useMemo(() => {
    if (!selectedNodeId) return explodedEdges;
    return filterToRelevantSubgraph(explodedEdges, selectedNodeId);
  }, [explodedEdges, selectedNodeId]);

  const nodeCount = useMemo(() => {
    const ids = new Set<string>();
    displayEdges.forEach((e) => {
      ids.add(e.source);
      ids.add(e.target);
    });
    return ids.size;
  }, [displayEdges]);

  const height = Math.max(420, nodeCount * 24);
  const showVpnHost = Boolean(endpointBrokerColors && endpointBrokerColors.brokerCount > 1);
  const graph = useMemo(
    () =>
      computeSankeyLayout(
        displayEdges,
        width,
        height,
        sortMode,
        endpointOwners,
        endpointBrokerLabels,
        showVpnHost ? endpointVpnHost : undefined,
      ),
    [
      displayEdges,
      width,
      height,
      sortMode,
      endpointOwners,
      endpointBrokerLabels,
      endpointVpnHost,
      showVpnHost,
    ],
  );

  // The whole ancestor+descendant flow through whatever is hovered. A
  // hovered link already arrives here as its target node id (see above),
  // so this one call handles nodes, text, and links identically.
  const hoveredFlowEdgeKeys = useMemo(() => {
    if (!hoveredNodeId) return null;
    const relevant = filterToRelevantSubgraph(displayEdges, hoveredNodeId);
    return new Set(relevant.map((e) => edgeKey(e.source, e.target)));
  }, [displayEdges, hoveredNodeId]);

  function handleExportSvg() {
    if (svgRef.current) downloadSvg(svgRef.current, width, height);
  }

  if (edges.length === 0) {
    return (
      <div className="sankey-empty">
        No topic subscriptions found - either no endpoint has any
        subscriptions, or the SEMP reply structure doesn't match the
        parser (see backend/src/semp/queries.ts).
      </div>
    );
  }

  return (
    <div ref={containerRef} className="sankey-container">
      <div className="sankey-toolbar">
        <div className="toolbar-group">
          <label className="toolbar-control">
            <span>View</span>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as DiagramViewMode)}
            >
              <option value="dataflow">Data flow (wildcard-aware)</option>
              <option value="subscriptions">Subscriptions (literal)</option>
            </select>
          </label>
          <label className="toolbar-toggle">
            <input
              type="checkbox"
              className="toolbar-toggle-input"
              checked={showDirectSubscribers}
              onChange={(e) => setShowDirectSubscribers(e.target.checked)}
            />
            <span className="toolbar-toggle-track" aria-hidden="true" />
            <span>Show direct subscribers</span>
          </label>
        </div>
        {/* Divider + "Sort by" grouped into one flex item, so flex-wrap on
            the toolbar never leaves the divider dangling alone at the end
            of a wrapped row - it only ever wraps together with the
            control it's introducing. */}
        <div className="toolbar-group">
          <div className="toolbar-divider" aria-hidden="true" />
          <label className="toolbar-control">
            <span>Sort by</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="topic">Topic name</option>
              <option value="queue">Endpoint</option>
              <option value="owner">Owner</option>
              <option value="messageVpn">Message VPN</option>
              <option value="crossing">Crossing minimized</option>
            </select>
          </label>
        </div>
        <div className="toolbar-group toolbar-actions">
          {selectedNodeId && (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setSelectedNodeId(null)}
            >
              Back to overview
            </button>
          )}
          <button type="button" className="toolbar-button" onClick={handleExportSvg}>
            Export as SVG
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label="Topic to endpoint Sankey diagram"
      >
        <defs>
          {/* Solace Brand Book 2025 v3.0, p.17, Gradient 16: Deep Green ->
              Deep Blue. userSpaceOnUse (not the SVG default
              objectBoundingBox) so this is ONE gradient spanning the whole
              diagram width - every highlighted link samples its slice of
              the same left-to-right sweep instead of getting its own
              isolated mini-gradient. */}
          <linearGradient
            id={FLOW_GRADIENT_ID}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={width}
            y2={0}
          >
            <stop offset="0%" stopColor="#009193" />
            <stop offset="100%" stopColor="#093B5F" />
          </linearGradient>
        </defs>
        <g>
          {graph.links.map((link, i) => {
            const d = linkPath(link as never);
            if (!d) return null;
            const { sourceId, targetId } = resolvedLinkIds(link);
            const isPartOfHoveredFlow = hoveredFlowEdgeKeys?.has(
              edgeKey(sourceId, targetId),
            );
            const visualStrokeWidth = Math.max(1, link.width ?? 1);
            return (
              <g key={i}>
                {/* Invisible, generously wide hit target - thin/low-value
                    flows are otherwise nearly impossible to hover
                    precisely. The visible path below has pointer-events
                    disabled so this is the only thing handling hover/click.
                    Both resolve to the link's TARGET node, so hovering or
                    clicking a connector behaves exactly like hovering or
                    clicking the block/text it leads into. */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(14, visualStrokeWidth)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredNodeId(targetId)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => setSelectedNodeId(targetId)}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={isPartOfHoveredFlow ? `url(#${FLOW_GRADIENT_ID})` : "#C2F7FF"}
                  strokeOpacity={isPartOfHoveredFlow ? 0.75 : 0.2}
                  strokeWidth={visualStrokeWidth}
                  style={{ pointerEvents: "none" }}
                />
              </g>
            );
          })}
        </g>
        <g>
          {graph.nodes.map((node) => {
            const x0 = node.x0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y0 = node.y0 ?? 0;
            const y1 = node.y1 ?? 0;
            // Endpoint column (the last level) gets its label to the
            // RIGHT of the bar; every other level gets it to the LEFT.
            // Deciding this by node ROLE rather than x-position avoids
            // labels flipping once a hierarchy has many levels and a
            // mid-level column's x-position crosses the diagram's midpoint.
            const isEndpoint = isEndpointNode(node.id);
            const labelOnRight = isEndpoint;
            const isSelected = node.id === selectedNodeId;
            const handleHoverStart = () => setHoveredNodeId(node.id);
            const handleHoverEnd = () => setHoveredNodeId(null);

            const mainLabel = isEndpoint
              ? endpointDisplayName(node.id)
              : nodeDisplayLabel(node.id);

            // Endpoint nodes stack up to three small sub-lines below the
            // name: type (Queue/Topic Endpoint - replaces the old "Queue: "
            // prefix on the name itself), owner (if the broker reports
            // one), and "vpn at host" (only shown once 2+ message VPNs are
            // connected - otherwise it's the same for every node and just
            // adds noise). Topic hierarchy nodes never have any of these.
            const subLines: string[] = [];
            if (isEndpoint) {
              const type = endpointTypeLabel(node.id);
              if (type) subLines.push(type);
              const owner = endpointOwners?.get(node.id);
              if (owner) subLines.push(owner);
              if (showVpnHost) {
                const vpnHost = endpointVpnHost?.get(node.id);
                if (vpnHost) subLines.push(vpnHost);
              }
            }

            const lineHeight = 11;
            const totalLines = 1 + subLines.length;
            const blockStartY = (y0 + y1) / 2 - ((totalLines - 1) * lineHeight) / 2;

            // Same idea as the links above: a generous invisible hit rect
            // (min. 10px tall, min. 4px padding) so thin, low-value nodes
            // are still easy to hover, independent of their true visual size.
            const visualHeight = Math.max(1, y1 - y0);
            const hitHeight = Math.max(10, visualHeight);
            const hitY = (y0 + y1) / 2 - hitHeight / 2;
            const hitWidth = Math.max(1, x1 - x0) + 4;
            const hitX = x0 - 2;

            return (
              <g
                key={node.id}
                className={
                  isSelected ? "sankey-node sankey-node--selected" : "sankey-node"
                }
                onClick={() => setSelectedNodeId(node.id)}
              >
                <rect
                  x={x0}
                  y={y0}
                  width={Math.max(1, x1 - x0)}
                  height={visualHeight}
                  fill={nodeColor(node.id, endpointBrokerColors)}
                  stroke={isSelected ? "#ABFF88" : "none"}
                  strokeWidth={isSelected ? 2 : 0}
                  rx={2}
                  style={{ pointerEvents: "none" }}
                >
                  <title>{node.id} (click to filter)</title>
                </rect>
                <rect
                  x={hitX}
                  y={hitY}
                  width={hitWidth}
                  height={hitHeight}
                  fill="transparent"
                  onMouseEnter={handleHoverStart}
                  onMouseLeave={handleHoverEnd}
                >
                  <title>{node.id} (click to filter)</title>
                </rect>
                <text
                  x={labelOnRight ? x1 + 6 : x0 - 6}
                  y={blockStartY}
                  dy="0.32em"
                  textAnchor={labelOnRight ? "start" : "end"}
                  fontSize={12}
                  fontWeight={isSelected ? 700 : 400}
                  fontFamily='"Space Mono", monospace'
                  fill={isSelected ? "#ABFF88" : "#FFFFFF"}
                  onMouseEnter={handleHoverStart}
                  onMouseLeave={handleHoverEnd}
                >
                  <title>{node.id} (click to filter)</title>
                  {mainLabel}
                </text>
                {subLines.map((line, i) => (
                  <text
                    key={i}
                    x={labelOnRight ? x1 + 6 : x0 - 6}
                    y={blockStartY + (i + 1) * lineHeight}
                    dy="0.32em"
                    textAnchor={labelOnRight ? "start" : "end"}
                    fontSize={10}
                    fontFamily='"Space Mono", monospace'
                    fill="rgba(255, 255, 255, 0.55)"
                    onMouseEnter={handleHoverStart}
                    onMouseLeave={handleHoverEnd}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
