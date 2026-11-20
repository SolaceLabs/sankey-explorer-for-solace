import type { EndpointInfo, EndpointMetrics, MetricsResponse } from "../types";
import { buildEndpointMetricsMap } from "./buildEndpointMetricsMap";
import { classifyAll, type EndpointActivity } from "./endpointActivity";
import { ACTIVITY_LABELS, formatBytes, formatPercent, formatRate } from "./formatMetrics";
import { effectiveRate } from "./endpointActivity";

/** Everything the diagram overlay needs from the latest metrics sample. */
export interface LiveMetricsView {
  byNodeId: ReadonlyMap<string, EndpointMetrics>;
  activity: ReadonlyMap<string, EndpointActivity>;
  sampledAt: number;
}

/**
 * Derives the overlay from the polling state. Null until there is a first
 * sample, so "no live data" and "everything idle" stay distinguishable.
 */
export function buildLiveMetricsView(
  endpoints: EndpointInfo[],
  current: MetricsResponse | null,
  previous: MetricsResponse | null,
): LiveMetricsView | null {
  if (!current) return null;
  const byNodeId = buildEndpointMetricsMap(endpoints, current.metrics);
  const previousByNodeId = previous ? buildEndpointMetricsMap(endpoints, previous.metrics) : null;
  return { byNodeId, activity: classifyAll(byNodeId, previousByNodeId), sampledAt: current.sampledAt };
}

/**
 * How a link INTO an endpoint is drawn. SEMP reports rates per endpoint,
 * never per subscription or topic, so only that last hop can honestly be
 * called active: it carries whatever the endpoint is currently receiving.
 */
export type LinkActivity = "active" | "idle";

export function linkActivityOf(view: LiveMetricsView | null, targetId: string): LinkActivity | null {
  const activity = view?.activity.get(targetId);
  if (!activity || activity.status === "unknown") return null;
  return activity.receiving ? "active" : "idle";
}

const TREND_WORDS: Record<EndpointActivity["trend"], string | null> = {
  growing: "growing",
  shrinking: "shrinking",
  steady: "steady",
  unknown: null,
};

/** Plain-text summary for the node tooltip (SVG <title>), one fact per line. */
export function activityTooltip(metrics: EndpointMetrics | undefined, activity: EndpointActivity | undefined): string[] {
  if (!metrics || !activity) return [];
  const lines = [`Live: ${ACTIVITY_LABELS[activity.status]}`, `In: ${formatRate(effectiveRate(metrics.inbound))} msg/s`];
  if (metrics.type === "direct-subscriber") return lines;
  lines.push(`Out: ${formatRate(effectiveRate(metrics.outbound))} msg/s`);
  const details = [
    activity.fillRatio === null ? null : `${formatPercent(activity.fillRatio)} of quota`,
    TREND_WORDS[activity.trend],
  ].filter((part): part is string => part !== null);
  lines.push(`Spool: ${formatBytes(metrics.spool.usageBytes)}${details.length > 0 ? ` (${details.join(", ")})` : ""}`);
  return lines;
}

/** What the selection panel shows for one node: undefined without an overlay at all. */
export function liveDetailsFor(view: LiveMetricsView | null | undefined, nodeId: string) {
  if (view === undefined) return undefined;
  return { hasSample: view !== null, metrics: view?.byNodeId.get(nodeId), activity: view?.activity.get(nodeId) };
}
