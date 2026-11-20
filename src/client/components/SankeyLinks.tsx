import { sankeyLinkHorizontal, type SankeyLink } from "d3-sankey";
import { resolvedLinkIds, type SankeyLinkDatum, type SankeyNodeDatum } from "../lib/sankeyLayout";
import { DIAGRAM_COLORS } from "../lib/diagramColors";
import { edgeKey } from "../lib/flowHighlight";

const FLOW_GRADIENT_ID = "sankey-flow-gradient";
const MIN_HIT_WIDTH = 14;

const linkPath = sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>();

interface SankeyLinksProps {
  links: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>[];
  diagramWidth: number;
  /** Edges of the hovered or selected flow; null while nothing is. */
  highlightedEdgeKeys: ReadonlySet<string> | null;
  /** A link stands for its TARGET node, exactly like that node's block and label. */
  onHover: (nodeId: string | null) => void;
  onSelect: (nodeId: string) => void;
}

/**
 * The flows of the diagram plus the one gradient they share. Only the
 * highlighted flow changes; every other link keeps its normal look while
 * something is hovered or selected.
 */
export function SankeyLinks({ links, diagramWidth, highlightedEdgeKeys, onHover, onSelect }: SankeyLinksProps) {
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
              />
              <path
                d={d}
                fill="none"
                stroke={isHighlighted ? `url(#${FLOW_GRADIENT_ID})` : DIAGRAM_COLORS.flow}
                strokeOpacity={isHighlighted ? 0.75 : 0.2}
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
