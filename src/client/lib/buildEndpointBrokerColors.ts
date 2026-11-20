import type { EndpointInfo } from "../types";
import { buildEndpointLabelMap } from "./buildEndpointLabelMap";
import { BROKER_PALETTE } from "./diagramColors";

/** Assigns each distinct label a color, in first-seen order, cycling the palette if needed. */
export function buildBrokerColorPalette(brokerLabelsInOrder: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const label of brokerLabelsInOrder) {
    if (!colors.has(label)) {
      // Palette is a non-empty constant and the index is modulo its length, so this is always defined.
      colors.set(label, BROKER_PALETTE[colors.size % BROKER_PALETTE.length]!);
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
