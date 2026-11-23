import type { EndpointMetrics, RateSample } from "../types";
import { effectiveRate, type EndpointActivity } from "./endpointActivity";

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

/** What the diagram shows under an endpoint: the status word and the numbers behind it. */
export interface LiveStatusLine {
  status: Exclude<EndpointActivity["status"], "unknown">;
  label: string;
  /** Empty for "Idle" - the word says it all. */
  detail: string;
}

export const ACTIVITY_LABELS: Record<EndpointActivity["status"], string> = {
  unknown: "No live data",
  idle: "Idle",
  flowing: "Flowing",
  "piling-up": "Piling up",
  stale: "Stale",
};

/** One sentence per status, for the legend and the selection panel. */
export const ACTIVITY_DESCRIPTIONS: Record<LiveStatusLine["status"], string> = {
  flowing: "messages are arriving or being delivered right now.",
  "piling-up": "consumers are working, but the queue still grows or is nearly full.",
  stale: "messages wait in the queue and nothing takes them out.",
  idle: "nothing in, nothing out.",
};

/** What waits in the spool: size, fill level and trend, whichever is known. */
function waitingDetail(metrics: Extract<EndpointMetrics, { spool: unknown }>, activity: EndpointActivity): string {
  const parts = [`${formatBytes(metrics.spool.usageBytes)} waiting`];
  if (activity.fillRatio !== null) parts.push(`${formatPercent(activity.fillRatio)} full`);
  if (activity.trend === "growing" || activity.trend === "shrinking") parts.push(activity.trend);
  return parts.join(" · ");
}

/**
 * The live status drawn next to an endpoint's name, e.g. "Piling up 80.0 MB
 * waiting · 80% full · growing", or null when there is nothing known to
 * show. Kept bounded: it shares the name's line in the label column, whose
 * width the layout reserves up front (LIVE_STATUS_LINE_TEMPLATE).
 */
export function liveStatusLine(metrics: EndpointMetrics, activity: EndpointActivity): LiveStatusLine | null {
  if (activity.status === "unknown") return null;
  const label = ACTIVITY_LABELS[activity.status];
  if (activity.status === "idle") return { status: "idle", label, detail: "" };
  if ((activity.status === "piling-up" || activity.status === "stale") && metrics.type !== "direct-subscriber") {
    return { status: activity.status, label, detail: waitingDetail(metrics, activity) };
  }
  const inbound = `${rate(metrics.inbound)}/s in`;
  const detail = metrics.type === "direct-subscriber" ? inbound : `${inbound} · ${rate(metrics.outbound)}/s out`;
  return { status: activity.status, label, detail };
}

/** The widest line liveStatusLine is expected to produce (label and detail) - used to reserve label width. */
export const LIVE_STATUS_LINE_TEMPLATE = "Piling up  1023.9 MB waiting · 100% full · shrinking";

/** Time of a sample for the toolbar, in the viewer's locale. */
export const formatSampleTime = (epochMs: number): string =>
  new Date(epochMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
