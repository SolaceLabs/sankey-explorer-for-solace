import type { BrokerQueryError, EndpointType } from "./types.js";

/**
 * Live operational telemetry for the endpoints in the diagram, read from
 * the SEMP v2 Monitor API. Every number is `null` when the broker reply did
 * not carry it (older broker, missing permission, malformed value) - "not
 * known" must never be confused with a real 0.
 */

/** A message rate in msg/s: the broker's instantaneous value and its 1-minute average. */
export interface RateSample {
  current: number | null;
  oneMinuteAverage: number | null;
}

/**
 * Spool occupancy of a queue or topic endpoint. SEMP v2 has no attribute
 * for the CURRENT number of messages (`spooledMsgCount` is a lifetime
 * counter), so the backlog is measured in bytes.
 */
export interface SpoolSample {
  /** `msgSpoolUsage`: bytes currently spooled. */
  usageBytes: number | null;
  /**
   * The configured quota (`maxMsgSpoolUsage` / `maxSpoolUsage`, MB in SEMP)
   * converted to bytes. Null when unknown or 0 (0 disables quota checking,
   * so there is no meaningful fill level).
   */
  quotaBytes: number | null;
  /** `txUnackedMsgCount`: delivered to consumers, not acknowledged yet. */
  unackedMsgCount: number | null;
}

interface EndpointRef {
  type: EndpointType;
  name: string;
  /** Same label as EndpointInfo.brokerLabel, so metrics map onto diagram nodes. */
  brokerLabel: string;
}

/** A queue or topic endpoint. */
export interface SpooledEndpointMetrics extends EndpointRef {
  type: "queue" | "topic-endpoint";
  /** Into the endpoint, from publishers (`rxMsgRate`). */
  inbound: RateSample;
  /** Out of the endpoint, to its consumers (`txMsgRate`). */
  outbound: RateSample;
  spool: SpoolSample;
  ingressEnabled: boolean | null;
  egressEnabled: boolean | null;
}

/** A client consuming off its own topic subscriptions. */
export interface DirectSubscriberMetrics extends EndpointRef {
  type: "direct-subscriber";
  /**
   * Delivered TO the client (SEMP `txMsgRate`, broker-perspective). This is
   * the direction of the diagram's flows, so it is the "inbound" side of
   * the node, matching SpooledEndpointMetrics.inbound.
   */
  inbound: RateSample;
  /** Published BY the client (SEMP `rxMsgRate`) - not part of the diagram's flows. */
  published: RateSample;
  clientUsername: string | null;
}

export type EndpointMetrics = SpooledEndpointMetrics | DirectSubscriberMetrics;

/** Reply of GET /api/metrics. Partial results work like EndpointsResponse. */
export interface MetricsResponse {
  /** Server time (ms since epoch) when the sample was taken. */
  sampledAt: number;
  metrics: EndpointMetrics[];
  errors: BrokerQueryError[];
}

/** One consumer flow bound to a queue or topic endpoint (SEMP `.../txFlows`). */
export interface ConsumerFlow {
  clientName: string;
  flowId: number | null;
  /** "active-consumer", "active-browser" or "inactive"; null if not reported. */
  activityState: string | null;
  /** Seconds since the Unix epoch. */
  bindTime: number | null;
  unackedMsgCount: number | null;
}

/** Reply of GET /api/metrics/consumers. */
export interface ConsumersResponse {
  flows: ConsumerFlow[];
}
