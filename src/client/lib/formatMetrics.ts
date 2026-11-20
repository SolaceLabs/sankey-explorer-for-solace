import type { EndpointMetrics, RateSample } from "../types";
import type { EndpointActivity } from "./endpointActivity";
import { effectiveRate } from "./endpointActivity";

const UNKNOWN = "n/a";

/** Compact msg/s: "0", "42", "1.2k", "3.4M". */
export function formatRate(value: number | null): string {
  if (value === null) return UNKNOWN;
  // Thresholds sit where the rounded value would roll over ("1000.0k"),
  // so the text never grows past its reserved width.
  if (value >= 999_950) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 999.5) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Binary units, one decimal from KB up: "0 B", "512 B", "3.2 MB". */
export function formatBytes(value: number | null): string {
  if (value === null) return UNKNOWN;
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit++;
  }
  return unit === 0 ? `${Math.round(size)} B` : `${size.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export const formatPercent = (ratio: number | null): string =>
  ratio === null ? UNKNOWN : `${Math.round(ratio * 100)}%`;

const rate = (sample: RateSample): string => formatRate(effectiveRate(sample));

const TREND_MARKS: Record<EndpointActivity["trend"], string> = {
  growing: " ↑",
  shrinking: " ↓",
  steady: "",
  unknown: "",
};

/**
 * The one-line summary drawn under an endpoint in the diagram, e.g.
 * "in 120/s · out 80/s · 3.2 MB 45% ↑". Kept short and bounded: it sits in
 * the label column, whose width is reserved up front (see sankeyLayout).
 */
export function metricsSubLine(metrics: EndpointMetrics, activity: EndpointActivity): string {
  if (metrics.type === "direct-subscriber") return `in ${rate(metrics.inbound)}/s`;
  const spool = `${formatBytes(metrics.spool.usageBytes)}${activity.fillRatio === null ? "" : ` ${formatPercent(activity.fillRatio)}`}`;
  return `in ${rate(metrics.inbound)}/s · out ${rate(metrics.outbound)}/s · ${spool}${TREND_MARKS[activity.trend]}`;
}

/** The widest line metricsSubLine is expected to produce - used to reserve label width. */
export const METRICS_SUB_LINE_TEMPLATE = "in 999.9k/s · out 999.9k/s · 1023.9 MB 100% ↑";

export const ACTIVITY_LABELS: Record<EndpointActivity["status"], string> = {
  unknown: "No live data",
  idle: "Idle",
  active: "Active",
  backlog: "Backlog",
};

/** Time of a sample for the toolbar, in the viewer's locale. */
export const formatSampleTime = (epochMs: number): string =>
  new Date(epochMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
