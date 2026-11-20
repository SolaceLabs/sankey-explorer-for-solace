import type { EndpointInfo } from "../types";
import { buildEndpointLabelMap } from "./buildEndpointLabelMap";

/**
 * Solace Brand Book 2025 v3.0, p.17. Deliberately excludes every color that
 * already carries a meaning elsewhere, so a broker color never reads as one:
 * - #FCA829 (orange) - warnings ("without subscriptions", search miss).
 * - #ABFF88 (bright green) - the selected node.
 * - #C2F7FF (light blue) - topic nodes and the topic-endpoint badge.
 * - #FFFFFF (white) - the direct-subscriber badge.
 * - #08223C / #093B5F (backgrounds/panels) - too low-contrast as a fill.
 * Ordered so the first two (the common two-broker case) differ the most.
 */
const BROKER_COLOR_PALETTE = [
  "#00C895", // Classic Green - 01
  "#FFF7C2", // Secondary Sunrise Yellow tint
  "#009193", // Secondary Deep Green
  "#C7FFCB", // Secondary Spring Green tint
];

/** Assigns each distinct label a color, in first-seen order, cycling the palette if needed. */
export function buildBrokerColorPalette(brokerLabelsInOrder: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const label of brokerLabelsInOrder) {
    if (!colors.has(label)) {
      // Palette is a non-empty constant and the index is modulo its length, so this is always defined.
      colors.set(label, BROKER_COLOR_PALETTE[colors.size % BROKER_COLOR_PALETTE.length]!);
    }
  }
  return colors;
}

export interface EndpointBrokerColors {
  /** Sankey node label (e.g. "Queue: orders-q (EU-Broker)") -> hex color. */
  colorByEndpointLabel: Map<string, string>;
  /** Number of distinct brokers in this dataset - callers use this to decide
   *  whether to color endpoints by broker at all (only worth it with 2+). */
  brokerCount: number;
}

export function buildEndpointBrokerColors(endpoints: EndpointInfo[]): EndpointBrokerColors {
  const brokerPalette = buildBrokerColorPalette(endpoints.map((e) => e.brokerLabel));
  const colorByEndpointLabel = buildEndpointLabelMap(endpoints, (e) =>
    brokerPalette.get(e.brokerLabel),
  );

  return { colorByEndpointLabel, brokerCount: brokerPalette.size };
}
