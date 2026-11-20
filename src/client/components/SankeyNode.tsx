import type { SankeyNode as LayoutNode } from "d3-sankey";
import type { SankeyLinkDatum, SankeyNodeDatum } from "../lib/sankeyLayout";
import { endpointDisplayName } from "../lib/endpointDisplayName";
import { nodeDisplayLabel } from "../lib/nodeDisplayLabel";
import { endpointTypeCode, endpointTypeLabel } from "../lib/nodeKind";
import { BADGE_COLORS, DIAGRAM_COLORS } from "../lib/diagramColors";

/** Badge geometry - sankeyLayout reserves ENDPOINT_BADGE_SPACE for it. */
const BADGE_WIDTH = 26;
const BADGE_HEIGHT = 16;
const BADGE_GAP = 8;
const LABEL_OFFSET = 6;
const LINE_HEIGHT = 12;
const DIMMED_OPACITY = 0.35;

interface SankeyNodeProps {
  node: LayoutNode<SankeyNodeDatum, SankeyLinkDatum>;
  isEndpoint: boolean;
  isSelected: boolean;
  /** Something else is hovered/selected and this node is not part of its flow. */
  isDimmed: boolean;
  color: string;
  subLines: string[];
  onHover: (nodeId: string | null) => void;
  onSelect: (nodeId: string) => void;
}

/**
 * One node of the diagram: its bar, a generous invisible hit area, its
 * label (left of the bar for topic levels, right of it for endpoints) and,
 * for endpoints, the Q / TE / DS type badge plus owner / VPN sub-lines.
 */
export function SankeyNode({ node, isEndpoint, isSelected, isDimmed, color, subLines, onHover, onSelect }: SankeyNodeProps) {
  const x0 = node.x0 ?? 0;
  const x1 = node.x1 ?? 0;
  const y0 = node.y0 ?? 0;
  const y1 = node.y1 ?? 0;
  const code = isEndpoint ? endpointTypeCode(node.id) : null;
  const label = isEndpoint ? endpointDisplayName(node.id) : nodeDisplayLabel(node.id);

  // Thin, low-value nodes stay easy to hit: min. 10px tall, 2px wider each side.
  const visualHeight = Math.max(1, y1 - y0);
  const hitHeight = Math.max(10, visualHeight);
  const blockStartY = (y0 + y1) / 2 - (subLines.length * LINE_HEIGHT) / 2;
  const textX = isEndpoint ? x1 + LABEL_OFFSET + (code ? BADGE_WIDTH + BADGE_GAP : 0) : x0 - LABEL_OFFSET;
  const hover = {
    onMouseEnter: () => onHover(node.id),
    onMouseLeave: () => onHover(null),
  };
  // The badge sits on the middle of the whole entry (name + sub-lines),
  // which is the middle of the bar - not on the name line.
  const badgeCenterY = (y0 + y1) / 2;

  return (
    <g
      className={isSelected ? "sankey-node sankey-node--selected" : "sankey-node"}
      opacity={isDimmed ? DIMMED_OPACITY : undefined}
      onClick={() => onSelect(node.id)}
    >
      <rect
        x={x0}
        y={y0}
        width={Math.max(1, x1 - x0)}
        height={visualHeight}
        fill={color}
        stroke={isSelected ? DIAGRAM_COLORS.selected : "none"}
        strokeWidth={isSelected ? 2 : 0}
        rx={2}
        style={{ pointerEvents: "none" }}
      />
      <rect
        x={x0 - 2}
        y={(y0 + y1) / 2 - hitHeight / 2}
        width={Math.max(1, x1 - x0) + 4}
        height={hitHeight}
        fill="transparent"
        {...hover}
      >
        <title>{node.id} (click for details)</title>
      </rect>
      {code && (
        <g className="sankey-badge" {...hover}>
          <title>{endpointTypeLabel(node.id)}</title>
          <rect
            x={x1 + LABEL_OFFSET + 0.75}
            y={badgeCenterY - BADGE_HEIGHT / 2 + 0.75}
            width={BADGE_WIDTH - 1.5}
            height={BADGE_HEIGHT - 1.5}
            rx={4}
            fill={BADGE_COLORS[code].fill}
            stroke={BADGE_COLORS[code].stroke}
            strokeWidth={1.5}
          />
          <text
            x={x1 + LABEL_OFFSET + BADGE_WIDTH / 2}
            y={badgeCenterY}
            dy="0.35em"
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fontFamily='"Figtree", sans-serif'
            fill={BADGE_COLORS[code].text}
          >
            {code}
          </text>
        </g>
      )}
      <text
        className="sankey-node-label"
        x={textX}
        y={blockStartY}
        dy="0.32em"
        textAnchor={isEndpoint ? "start" : "end"}
        fontSize={12}
        fontWeight={isSelected ? 700 : 400}
        fontFamily='"Space Mono", monospace'
        fill={isSelected ? DIAGRAM_COLORS.selected : DIAGRAM_COLORS.label}
        {...hover}
      >
        {label}
      </text>
      {subLines.map((line, i) => (
        <text
          key={`${i}-${line}`}
          x={textX}
          y={blockStartY + (i + 1) * LINE_HEIGHT}
          dy="0.32em"
          textAnchor="start"
          fontSize={10}
          fontFamily='"Space Mono", monospace'
          fill={DIAGRAM_COLORS.subLabel}
          {...hover}
        >
          {line}
        </text>
      ))}
    </g>
  );
}
