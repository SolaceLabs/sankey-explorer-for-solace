import type { EndpointInfo, EndpointMetrics } from "../types";
import { buildEndpointLabelMap } from "./buildEndpointLabelMap";

/** Identity shared by an endpoint and its metrics: type, name and broker. */
const identityOf = (e: Pick<EndpointInfo, "type" | "name" | "brokerLabel">): string =>
  `${e.type}\u0000${e.name}\u0000${e.brokerLabel}`;

/**
 * Sankey node id -> that endpoint's latest metrics. Keyed exactly like the
 * diagram's own nodes (via buildEndpointLabelMap / endpointLabel), so the
 * broker suffix rule can never differ between the two. Only endpoints in
 * the loaded configuration get an entry: metrics for objects the diagram
 * doesn't draw (e.g. clients without direct subscriptions) are ignored, and
 * a node whose object is missing from the sample simply has none.
 */
export function buildEndpointMetricsMap(
  endpoints: EndpointInfo[],
  metrics: readonly EndpointMetrics[],
): Map<string, EndpointMetrics> {
  const byIdentity = new Map(metrics.map((m) => [identityOf(m), m]));
  return buildEndpointLabelMap(endpoints, (e) => byIdentity.get(identityOf(e)));
}
