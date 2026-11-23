import type { EndpointMetrics, RateSample } from "../types";

/**
 * The terms are the UI's own ("Flowing", "Piling up", "Idle"):
 * - "unknown": no usable sample for this endpoint
 * - "idle": known, and no messages moving
 * - "flowing": messages are arriving (or leaving, for a queue/topic endpoint)
 * - "piling-up": a queue/topic endpoint is holding messages that are not
 *   being drained: spool growing, close to its quota, or nothing going out
 */
export type ActivityStatus = "unknown" | "idle" | "flowing" | "piling-up";

export type SpoolTrend = "growing" | "shrinking" | "steady" | "unknown";

export interface EndpointActivity {
  status: ActivityStatus;
  trend: SpoolTrend;
  /** Spool usage / quota (0..1+), null without both values. */
  fillRatio: number | null;
  /** Messages are currently arriving at this endpoint from the topic side. */
  receiving: boolean;
  /** Messages are currently leaving towards consumers (queues/topic endpoints only). */
  sending: boolean;
}

/** At or above this share of its quota a spool counts as piling up even if it drains. */
export const PILING_UP_FILL_RATIO = 0.8;

const UNKNOWN: EndpointActivity = { status: "unknown", trend: "unknown", fillRatio: null, receiving: false, sending: false };

/** The instantaneous rate, falling back to the 1-minute average when the broker omits it. */
export const effectiveRate = (rate: RateSample): number | null => rate.current ?? rate.oneMinuteAverage;

const isMoving = (rate: RateSample): boolean => (effectiveRate(rate) ?? 0) > 0;
const hasRate = (rate: RateSample): boolean => effectiveRate(rate) !== null;

export function spoolTrend(current: number | null, previous: number | null | undefined): SpoolTrend {
  if (current === null || previous === null || previous === undefined) return "unknown";
  if (current > previous) return "growing";
  if (current < previous) return "shrinking";
  return "steady";
}

/**
 * Classifies one endpoint from its latest sample, using the sample before
 * it (same endpoint) for the spool trend. Pure: the overlay, tooltips and
 * the detail panel all read the same verdict.
 */
export function classifyEndpointActivity(
  metrics: EndpointMetrics | undefined,
  previous?: EndpointMetrics,
): EndpointActivity {
  if (!metrics) return UNKNOWN;
  const receiving = isMoving(metrics.inbound);

  if (metrics.type === "direct-subscriber") {
    if (!hasRate(metrics.inbound)) return UNKNOWN;
    return { status: receiving ? "flowing" : "idle", trend: "unknown", fillRatio: null, receiving, sending: false };
  }

  const { usageBytes, quotaBytes } = metrics.spool;
  const previousUsage = previous?.type === metrics.type ? previous.spool.usageBytes : undefined;
  const trend = spoolTrend(usageBytes, previousUsage);
  const fillRatio = usageBytes !== null && quotaBytes ? usageBytes / quotaBytes : null;
  const sending = isMoving(metrics.outbound);

  if (!hasRate(metrics.inbound) && !hasRate(metrics.outbound) && usageBytes === null) return UNKNOWN;

  const holdsMessages = (usageBytes ?? 0) > 0;
  const pilingUp =
    holdsMessages && (trend === "growing" || (fillRatio ?? 0) >= PILING_UP_FILL_RATIO || !sending);
  if (pilingUp) return { status: "piling-up", trend, fillRatio, receiving, sending };
  return { status: receiving || sending ? "flowing" : "idle", trend, fillRatio, receiving, sending };
}

/** Classifies every node that has metrics; `previous` is the prior sample's map. */
export function classifyAll(
  current: ReadonlyMap<string, EndpointMetrics>,
  previous: ReadonlyMap<string, EndpointMetrics> | null,
): Map<string, EndpointActivity> {
  const result = new Map<string, EndpointActivity>();
  for (const [nodeId, metrics] of current) {
    result.set(nodeId, classifyEndpointActivity(metrics, previous?.get(nodeId)));
  }
  return result;
}
