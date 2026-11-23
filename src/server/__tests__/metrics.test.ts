import { describe, expect, it, vi } from "vitest";
import { SempError, type SempV2Client } from "../semp/client.js";
import {
  CLIENT_METRIC_FIELDS,
  QUEUE_METRIC_FIELDS,
  TOPIC_ENDPOINT_METRIC_FIELDS,
  fetchConsumerFlows,
  fetchMetricsAcrossConnections,
  fetchVpnMetrics,
  parseClient,
  parseSpooledEndpoint,
  parseTxFlow,
  toBool,
  toCount,
} from "../semp/metrics.js";
import type { FetchableBrokerConnection } from "../semp/acrossConnections.js";

const MB = 1024 * 1024;

/** Resolves getVpnCollection(vpn, path, select) from a table keyed by path, recording every call. */
function fakeClient(responses: Record<string, unknown[]>, failWith?: Error) {
  const calls: Array<{ vpn: string; path: string; select?: readonly string[] }> = [];
  const client = {
    getVpnCollection: vi.fn((vpn: string, path: string, select?: readonly string[]) => {
      calls.push({ vpn, path, select });
      if (failWith) return Promise.reject(failWith);
      return Promise.resolve(responses[path] ?? []);
    }),
  } as unknown as SempV2Client;
  return { client, calls };
}

describe("toCount / toBool", () => {
  it("keeps zero as a real value instead of treating it as missing", () => {
    expect(toCount(0)).toBe(0);
  });

  it.each([undefined, null, "12", Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "maps %s to null (not reported or not a usable count)",
    (value) => expect(toCount(value)).toBeNull(),
  );

  it("only accepts real booleans", () => {
    expect(toBool(false)).toBe(false);
    expect(toBool("true")).toBeNull();
    expect(toBool(undefined)).toBeNull();
  });
});

describe("parseSpooledEndpoint", () => {
  it("maps a queue's SEMP rates, spool usage (bytes) and quota (MB -> bytes)", () => {
    const result = parseSpooledEndpoint(
      {
        queueName: "orders-q",
        rxMsgRate: 120,
        averageRxMsgRate: 100,
        txMsgRate: 80,
        averageTxMsgRate: 90,
        msgSpoolUsage: 2 * MB,
        maxMsgSpoolUsage: 8,
        txUnackedMsgCount: 3,
        ingressEnabled: true,
        egressEnabled: false,
      },
      "queue",
      "EU",
    );

    expect(result).toEqual({
      type: "queue",
      name: "orders-q",
      brokerLabel: "EU",
      inbound: { current: 120, oneMinuteAverage: 100 },
      outbound: { current: 80, oneMinuteAverage: 90 },
      spool: { usageBytes: 2 * MB, quotaBytes: 8 * MB, unackedMsgCount: 3 },
      ingressEnabled: true,
      egressEnabled: false,
    });
  });

  it("reads the topic endpoint's differently named quota attribute (maxSpoolUsage)", () => {
    const result = parseSpooledEndpoint(
      { topicEndpointName: "te-1", maxSpoolUsage: 4, maxMsgSpoolUsage: 99 },
      "topic-endpoint",
      "EU",
    );
    expect(result?.spool.quotaBytes).toBe(4 * MB);
  });

  it("degrades every missing field to null rather than 0, so 'unknown' never reads as 'idle'", () => {
    const result = parseSpooledEndpoint({ queueName: "bare-q" }, "queue", "EU");
    expect(result).toEqual({
      type: "queue",
      name: "bare-q",
      brokerLabel: "EU",
      inbound: { current: null, oneMinuteAverage: null },
      outbound: { current: null, oneMinuteAverage: null },
      spool: { usageBytes: null, quotaBytes: null, unackedMsgCount: null },
      ingressEnabled: null,
      egressEnabled: null,
    });
  });

  it("treats a 0 MB quota as 'no quota' (SEMP: 0 disables quota checking)", () => {
    expect(parseSpooledEndpoint({ queueName: "q", maxMsgSpoolUsage: 0 }, "queue", "EU")?.spool.quotaBytes).toBeNull();
  });

  it("drops an object without a usable name (it could not be matched to a node)", () => {
    expect(parseSpooledEndpoint({ rxMsgRate: 5 }, "queue", "EU")).toBeNull();
    expect(parseSpooledEndpoint({ queueName: "" }, "queue", "EU")).toBeNull();
  });
});

describe("parseClient", () => {
  it("uses the broker-perspective txMsgRate as the inbound (delivered-to-client) rate", () => {
    const result = parseClient(
      { clientName: "app-1", clientUsername: "svc", rxMsgRate: 7, averageRxMsgRate: 6, txMsgRate: 50, averageTxMsgRate: 40 },
      "EU",
    );
    expect(result).toEqual({
      type: "direct-subscriber",
      name: "app-1",
      brokerLabel: "EU",
      inbound: { current: 50, oneMinuteAverage: 40 },
      published: { current: 7, oneMinuteAverage: 6 },
      clientUsername: "svc",
    });
  });

  it("returns null without a clientName and a null username when none is reported", () => {
    expect(parseClient({ txMsgRate: 1 }, "EU")).toBeNull();
    expect(parseClient({ clientName: "x" }, "EU")?.clientUsername).toBeNull();
  });
});

describe("parseTxFlow", () => {
  it("maps a consumer flow and tolerates missing optional fields", () => {
    expect(parseTxFlow({ clientName: "c1", flowId: 7, activityState: "active-consumer", bindTime: 1700000000, unackedMsgCount: 2 })).toEqual({
      clientName: "c1",
      flowId: 7,
      activityState: "active-consumer",
      bindTime: 1700000000,
      unackedMsgCount: 2,
    });
    expect(parseTxFlow({ clientName: "c2" })).toEqual({
      clientName: "c2",
      flowId: null,
      activityState: null,
      bindTime: null,
      unackedMsgCount: null,
    });
    expect(parseTxFlow({ flowId: 1 })).toBeNull();
  });
});

describe("fetchVpnMetrics", () => {
  it("makes exactly three list calls, each limited with select, and combines the results", async () => {
    const { client, calls } = fakeClient({
      "/queues": [{ queueName: "q1", rxMsgRate: 1 }],
      "/topicEndpoints": [{ topicEndpointName: "te1" }],
      "/clients": [{ clientName: "c1" }, { clientUsername: "nameless" }],
    });

    const metrics = await fetchVpnMetrics(client, "default", "EU");

    expect(metrics.map((m) => `${m.type}:${m.name}`)).toEqual(["queue:q1", "topic-endpoint:te1", "direct-subscriber:c1"]);
    expect(calls).toEqual([
      { vpn: "default", path: "/queues", select: QUEUE_METRIC_FIELDS },
      { vpn: "default", path: "/topicEndpoints", select: TOPIC_ENDPOINT_METRIC_FIELDS },
      { vpn: "default", path: "/clients", select: CLIENT_METRIC_FIELDS },
    ]);
  });
});

describe("fetchMetricsAcrossConnections", () => {
  const conn = (label: string, client: SempV2Client): FetchableBrokerConnection => ({
    client,
    label,
    vpn: "default",
    baseUrl: "http://broker:8080",
  });

  it("stamps the sample time and keeps one broker's failure from hiding the others", async () => {
    const good = fakeClient({ "/queues": [{ queueName: "q1" }] });
    const bad = fakeClient({}, new SempError("HTTP 503"));

    const result = await fetchMetricsAcrossConnections([conn("Good", good.client), conn("Bad", bad.client)], () => 42);

    expect(result.sampledAt).toBe(42);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0]!.brokerLabel).toBe("Good");
    expect(result.errors).toEqual([{ brokerLabel: "Bad", message: "HTTP 503" }]);
  });

  it("never leaks a non-SEMP error's message to the client", async () => {
    const bad = fakeClient({}, new Error("internal detail"));
    const result = await fetchMetricsAcrossConnections([conn("Bad", bad.client)]);
    expect(result.errors).toEqual([{ brokerLabel: "Bad", message: "Unexpected error" }]);
  });
});

describe("fetchConsumerFlows", () => {
  it("URL-encodes the endpoint name and picks the collection by type", async () => {
    const { client, calls } = fakeClient({
      "/queues/a%20q%2Fx/txFlows": [{ clientName: "c1" }],
      "/topicEndpoints/te/txFlows": [{ clientName: "c2" }, {}],
    });

    const queueFlows = await fetchConsumerFlows(client, "default", "queue", "a q/x");
    const teFlows = await fetchConsumerFlows(client, "default", "topic-endpoint", "te");

    expect(queueFlows.map((f) => f.clientName)).toEqual(["c1"]);
    expect(teFlows.map((f) => f.clientName)).toEqual(["c2"]);
    expect(calls.map((c) => c.path)).toEqual(["/queues/a%20q%2Fx/txFlows", "/topicEndpoints/te/txFlows"]);
  });
});
