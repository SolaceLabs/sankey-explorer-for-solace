import { sankeyLinkHorizontal, type SankeyLink } from "d3-sankey";
import { resolvedLinkIds, type SankeyLinkDatum, type SankeyNodeDatum } from "../lib/sankeyLayout";
import { ACTIVE_FLOW_COLOR, DIAGRAM_COLORS } from "../lib/diagramColors";
import type { LinkActivity } from "../lib/liveMetricsView";
import { edgeKey } from "../lib/flowHighlight";

const FLOW_GRADIENT_ID = "sankey-flow-gradient";
const MIN_HIT_WIDTH = 14;

const linkPath = sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>();

interface SankeyLinksProps {
  links: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>[];
  diagramWidth: number;
  /** Edges of the hovered or selected flow; null while nothing is. */
  highlightedEdgeKeys: ReadonlySet<string> | null;
  /** Live metrics: whether the endpoint a link leads into is receiving; null = no data. */
  linkActivity?: (targetId: string) => LinkActivity | null;
  /** A link stands for its TARGET node, exactly like that node's block and label. */
  onHover: (nodeId: string | null) => void;
  onSelect: (nodeId: string) => void;
}

/**
 * The flows of the diagram plus the one gradient they share. Only the
 * highlighted flow changes; every other link keeps its normal look while
 * something is hovered or selected.
 */
/**
 * Normal look, then the live-metrics variants. The highlighted flow wins
 * over all of them; while one is highlighted, active links step back to
 * the normal strength so they don't outshine it.
 */
const LINK_STYLES: Record<LinkActivity | "default", { stroke: string; opacity: number; opacityBehindHighlight: number }> = {
  default: { stroke: DIAGRAM_COLORS.flow, opacity: 0.2, opacityBehindHighlight: 0.2 },
  active: { stroke: ACTIVE_FLOW_COLOR, opacity: 0.5, opacityBehindHighlight: 0.2 },
  idle: { stroke: DIAGRAM_COLORS.flow, opacity: 0.08, opacityBehindHighlight: 0.08 },
};

export function SankeyLinks({ links, diagramWidth, highlightedEdgeKeys, linkActivity, onHover, onSelect }: SankeyLinksProps) {
  return (
    <>
      <defs>
        {/* Solace Brand Book 2025 v3.0, p.17, Gradient 16: Deep Green ->
            Deep Blue. userSpaceOnUse (not the SVG default
            objectBoundingBox) so this is ONE gradient spanning the whole
            diagram width - every highlighted link samples its slice of
            the same left-to-right sweep instead of restarting per link. */}
        <linearGradient id={FLOW_GRADIENT_ID} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={diagramWidth} y2={0}>
          <stop offset="0%" stopColor={DIAGRAM_COLORS.flowGradient[0]} />
          <stop offset="100%" stopColor={DIAGRAM_COLORS.flowGradient[1]} />
        </linearGradient>
      </defs>
      <g>
        {links.map((link, i) => {
          const d = linkPath(link);
          if (!d) return null;
          const { sourceId, targetId } = resolvedLinkIds(link);
          const isHighlighted = highlightedEdgeKeys?.has(edgeKey(sourceId, targetId)) ?? false;
          const strokeWidth = Math.max(1, link.width ?? 1);
          const live = linkActivity?.(targetId) ?? null;
          const style = LINK_STYLES[live ?? "default"];
          return (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(MIN_HIT_WIDTH, strokeWidth)}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => onHover(targetId)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(targetId)}
              >
                {live && <title>{`${targetId}: ${live === "active" ? "receiving messages now" : "no messages arriving"}`}</title>}
              </path>
              <path
                className={live ? `sankey-link sankey-link--${live}` : "sankey-link"}
                d={d}
                fill="none"
                stroke={isHighlighted ? `url(#${FLOW_GRADIENT_ID})` : style.stroke}
                strokeOpacity={isHighlighted ? 0.75 : highlightedEdgeKeys ? style.opacityBehindHighlight : style.opacity}
                strokeWidth={strokeWidth}
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}
      </g>
    </>
  );
}
