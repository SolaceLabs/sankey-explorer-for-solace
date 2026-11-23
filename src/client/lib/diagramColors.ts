import type { EndpointType } from "../../shared/types";
import type { EndpointBrokerColors } from "./buildEndpointBrokerColors";
import { endpointTypeOf, type EndpointTypeCode } from "./nodeKind";

/**
 * Solace Brand Book 2025 v3.0, p.17 - the colors the diagram uses as SVG
 * attributes. They have to be literal values, not CSS variables: the SVG
 * export copies the drawing without the page stylesheet. index.css holds
 * the same brand values as tokens for the HTML around the diagram.
 */
const BRAND = {
  classicGreen: "#00C895",
  brightGreen: "#ABFF88",
  deepGreen: "#009193",
  deepBlue: "#093B5F",
  darkBlue: "#03213B",
  lightBlue: "#C2F7FF",
  sunriseYellow: "#FFF7C2",
  springGreen: "#C7FFCB",
  orange: "#FCA829",
  white: "#FFFFFF",
} as const;

/** What each part of the diagram is drawn in. */
export const DIAGRAM_COLORS = {
  topicNode: BRAND.lightBlue,
  flow: BRAND.lightBlue,
  /** Solace Gradient 16 (Deep Green -> Deep Blue), for the highlighted flow. */
  flowGradient: [BRAND.deepGreen, BRAND.deepBlue],
  selected: BRAND.brightGreen,
  label: BRAND.white,
  subLabel: "rgba(255, 255, 255, 0.65)",
  /** Standalone background the SVG export adds (the live SVG is transparent). */
  exportBackground: BRAND.deepBlue,
} as const;

/**
 * Live status colors - the icon and word under an endpoint, the legend and
 * the detail panel. Flowing reuses the brand's Bright Green (the selection
 * is an outline around the whole bar, never text, so the two don't
 * collide); piling up is the brand orange that already means "warning".
 * Every status also has its own icon and word, so color is never the only
 * signal.
 */
export const ACTIVITY_COLORS: Readonly<Record<"flowing" | "piling-up" | "idle", string>> = {
  flowing: BRAND.brightGreen,
  "piling-up": BRAND.orange,
  idle: "rgba(255, 255, 255, 0.75)",
};

/** Links into an endpoint that is receiving messages right now. */
export const ACTIVE_FLOW_COLOR = BRAND.classicGreen;

/** Endpoint bars with a single broker; the badges use the same colors. */
export const ENDPOINT_TYPE_COLORS: Readonly<Record<EndpointType, string>> = {
  queue: BRAND.classicGreen,
  "topic-endpoint": BRAND.lightBlue,
  "direct-subscriber": BRAND.white,
};

/** Q / TE / DS badges - same as .type-badge in index.css. */
export const BADGE_COLORS: Readonly<Record<EndpointTypeCode, { fill: string; stroke: string; text: string }>> = {
  Q: { fill: BRAND.classicGreen, stroke: "none", text: BRAND.darkBlue },
  TE: { fill: BRAND.lightBlue, stroke: "none", text: BRAND.darkBlue },
  DS: { fill: "none", stroke: BRAND.white, text: BRAND.white },
};

/**
 * Colors that already mean something - warning (orange), selection
 * (bright green), topics / topic endpoints (light blue), direct
 * subscribers (white) - so a broker color must never be one of them.
 */
export const RESERVED_COLORS: readonly string[] = [BRAND.orange, BRAND.brightGreen, BRAND.lightBlue, BRAND.white];

/**
 * Per-broker colors (two or more brokers). Ordered so the first two - the
 * common two-broker case - differ the most.
 */
export const BROKER_PALETTE: readonly string[] = [
  BRAND.classicGreen,
  BRAND.sunriseYellow,
  BRAND.deepGreen,
  BRAND.springGreen,
];

/**
 * Fill of a node's bar: the topic color for topic levels; for endpoints the
 * broker color once two or more brokers are connected (which broker is the
 * more useful signal then, and the badge still shows the type), else the
 * endpoint type's color.
 */
export function nodeFillColor(id: string, brokerColors: EndpointBrokerColors | undefined): string {
  const type = endpointTypeOf(id);
  if (!type) return DIAGRAM_COLORS.topicNode;
  const brokerColor = brokerColors && brokerColors.brokerCount > 1 ? brokerColors.colorByEndpointLabel.get(id) : undefined;
  return brokerColor ?? ENDPOINT_TYPE_COLORS[type];
}
