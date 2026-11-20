import type { SempV2Client } from "./client.js";
import { queryAcrossConnections, type FetchableBrokerConnection } from "./acrossConnections.js";
import type {
  ConsumerFlow,
  DirectSubscriberMetrics,
  EndpointMetrics,
  MetricsResponse,
  RateSample,
  SpooledEndpointMetrics,
} from "../../shared/metrics.js";

/**
 * Live telemetry from the SEMP v2 Monitor API. Field names checked against
 * the broker's published monitor spec (SEMP 10.26; all of them are part of
 * the monitor API's base version, see the 2.23 spec too):
 *
 *   GET /msgVpns/{vpn}/queues          -> queueName, rxMsgRate, txMsgRate,
 *        averageRxMsgRate, averageTxMsgRate, msgSpoolUsage (bytes),
 *        maxMsgSpoolUsage (MB), txUnackedMsgCount, ingressEnabled, egressEnabled
 *   GET /msgVpns/{vpn}/topicEndpoints  -> same, but the quota is `maxSpoolUsage`
 *   GET /msgVpns/{vpn}/clients         -> clientName, clientUsername, rxMsgRate,
 *        txMsgRate, averageRxMsgRate, averageTxMsgRate
 *   GET .../queues/{q}/txFlows, .../topicEndpoints/{te}/txFlows
 *                                      -> clientName, flowId, activityState,
 *        bindTime, unackedMsgCount
 *
 * Not available in SEMP v2 (so deliberately not shown): a current bind
 * count and a current message count for queues/topic endpoints.
 * `spooledMsgCount` is a lifetime counter ("messages that were spooled"),
 * not the depth - the backlog is `msgSpoolUsage` in bytes instead.
 * Consumers are only listable per endpoint via `txFlows`, which is why that
 * is an on-demand call for one selected endpoint, not part of every poll.
 *
 * One poll costs three list requests per message VPN (more only past 100
 * objects per collection), all with `select` so the replies stay small.
 */

/**
 * SEMP reports quotas in MB. Assumption (not stated in the SEMP spec): a
 * binary MB of 2^20 bytes, as the broker's own CLI uses. With a decimal MB
 * the fill level would read about 5% high - fine for spotting backlogs.
 */
const BYTES_PER_MB = 1024 * 1024;

type SempObject = Record<string, unknown>;

const RATE_FIELDS = ["rxMsgRate", "txMsgRate", "averageRxMsgRate", "averageTxMsgRate"] as const;
const SPOOL_FIELDS = ["msgSpoolUsage", "txUnackedMsgCount", "ingressEnabled", "egressEnabled"] as const;

export const QUEUE_METRIC_FIELDS = ["queueName", ...RATE_FIELDS, ...SPOOL_FIELDS, "maxMsgSpoolUsage"] as const;
export const TOPIC_ENDPOINT_METRIC_FIELDS = ["topicEndpointName", ...RATE_FIELDS, ...SPOOL_FIELDS, "maxSpoolUsage"] as const;
export const CLIENT_METRIC_FIELDS = ["clientName", "clientUsername", ...RATE_FIELDS] as const;
export const TX_FLOW_FIELDS = ["clientName", "flowId", "activityState", "bindTime", "unackedMsgCount"] as const;

/** A non-negative finite number, or null for anything else (absent, string, NaN, negative). */
export const toCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

export const toBool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const toText = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

const rateSample = (current: unknown, average: unknown): RateSample => ({
  current: toCount(current),
  oneMinuteAverage: toCount(average),
});

const quotaBytes = (quotaMb: unknown): number | null => {
  const mb = toCount(quotaMb);
  return mb ? mb * BYTES_PER_MB : null;
};

/**
 * One queue or topic endpoint object -> its metrics, or null if the object
 * has no usable name (then it cannot be matched to a diagram node anyway).
 */
export function parseSpooledEndpoint(
  raw: SempObject,
  type: SpooledEndpointMetrics["type"],
  brokerLabel: string,
): SpooledEndpointMetrics | null {
  const name = toText(type === "queue" ? raw.queueName : raw.topicEndpointName);
  if (!name) return null;
  return {
    type,
    name,
    brokerLabel,
    inbound: rateSample(raw.rxMsgRate, raw.averageRxMsgRate),
    outbound: rateSample(raw.txMsgRate, raw.averageTxMsgRate),
    spool: {
      usageBytes: toCount(raw.msgSpoolUsage),
      quotaBytes: quotaBytes(type === "queue" ? raw.maxMsgSpoolUsage : raw.maxSpoolUsage),
      unackedMsgCount: toCount(raw.txUnackedMsgCount),
    },
    ingressEnabled: toBool(raw.ingressEnabled),
    egressEnabled: toBool(raw.egressEnabled),
  };
}

/**
 * One client object -> its metrics. SEMP rates are broker-perspective: `tx`
 * is what the broker sends TO the client (the flow the diagram draws into
 * a direct subscriber), `rx` is what the client publishes.
 */
export function parseClient(raw: SempObject, brokerLabel: string): DirectSubscriberMetrics | null {
  const name = toText(raw.clientName);
  if (!name) return null;
  return {
    type: "direct-subscriber",
    name,
    brokerLabel,
    inbound: rateSample(raw.txMsgRate, raw.averageTxMsgRate),
    published: rateSample(raw.rxMsgRate, raw.averageRxMsgRate),
    clientUsername: toText(raw.clientUsername),
  };
}

export function parseTxFlow(raw: SempObject): ConsumerFlow | null {
  const clientName = toText(raw.clientName);
  if (!clientName) return null;
  return {
    clientName,
    flowId: toCount(raw.flowId),
    activityState: toText(raw.activityState),
    bindTime: toCount(raw.bindTime),
    unackedMsgCount: toCount(raw.unackedMsgCount),
  };
}

const isPresent = <T>(value: T | null): value is T => value !== null;

/** Every queue, topic endpoint and client of one VPN, as metrics. */
export async function fetchVpnMetrics(
  client: SempV2Client,
  vpn: string,
  brokerLabel: string,
): Promise<EndpointMetrics[]> {
  const [queues, topicEndpoints, clients] = await Promise.all([
    client.getVpnCollection<SempObject>(vpn, "/queues", QUEUE_METRIC_FIELDS),
    client.getVpnCollection<SempObject>(vpn, "/topicEndpoints", TOPIC_ENDPOINT_METRIC_FIELDS),
    client.getVpnCollection<SempObject>(vpn, "/clients", CLIENT_METRIC_FIELDS),
  ]);
  return [
    ...queues.map((q) => parseSpooledEndpoint(q, "queue", brokerLabel)),
    ...topicEndpoints.map((te) => parseSpooledEndpoint(te, "topic-endpoint", brokerLabel)),
    ...clients.map((c) => parseClient(c, brokerLabel)),
  ].filter(isPresent);
}

/** One metrics sample across all connections; per-broker failures stay isolated. */
export async function fetchMetricsAcrossConnections(
  connections: FetchableBrokerConnection[],
  now: () => number = Date.now,
): Promise<MetricsResponse> {
  const { items, errors } = await queryAcrossConnections(connections, (conn) =>
    fetchVpnMetrics(conn.client, conn.vpn, conn.label),
  );
  return { sampledAt: now(), metrics: items, errors };
}

/** The consumer flows currently bound to one queue or topic endpoint. */
export async function fetchConsumerFlows(
  client: SempV2Client,
  vpn: string,
  type: SpooledEndpointMetrics["type"],
  name: string,
): Promise<ConsumerFlow[]> {
  const collection = type === "queue" ? "queues" : "topicEndpoints";
  const flows = await client.getVpnCollection<SempObject>(
    vpn,
    `/${collection}/${encodeURIComponent(name)}/txFlows`,
    TX_FLOW_FIELDS,
  );
  return flows.map(parseTxFlow).filter(isPresent);
}
