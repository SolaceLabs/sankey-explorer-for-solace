import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createServer } from "../server.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? "OK" : "Error", json: () => Promise.resolve(body) } as unknown as Response;
}

/** A small broker: one queue with traffic, no topic endpoints, one client, one consumer flow. */
function mockBrokerFetch() {
  return vi.fn((url: string) => {
    if (url.endsWith("/SEMP/v2/monitor")) return Promise.resolve(jsonResponse({ data: { version: "10.26" } }));
    if (url.includes("/queues/orders-q/txFlows")) {
      return Promise.resolve(jsonResponse({ data: [{ clientName: "consumer-1", activityState: "active-consumer" }] }));
    }
    // Any other endpoint's flows: the broker does not know it.
    if (url.includes("/txFlows")) return Promise.resolve(jsonResponse({}, false, 400));
    if (url.includes("/queues")) {
      return Promise.resolve(jsonResponse({ data: [{ queueName: "orders-q", rxMsgRate: 12, msgSpoolUsage: 2048 }] }));
    }
    if (url.includes("/topicEndpoints")) return Promise.resolve(jsonResponse({ data: [] }));
    if (url.includes("/clients")) return Promise.resolve(jsonResponse({ data: [{ clientName: "app-1", txMsgRate: 3 }] }));
    return Promise.resolve(jsonResponse({}, false, 400));
  });
}

const app = await createServer({ serveClient: false });

async function connectedAgent(label = "EU") {
  const agent = request.agent(app);
  await agent.post("/api/connection").send({ baseUrl: "http://localhost:8080", vpn: "default", username: "ro", password: "x", label });
  return agent;
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockBrokerFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/metrics", () => {
  it("400s before any broker is connected", async () => {
    const res = await request(app).get("/api/metrics");
    expect(res.status).toBe(400);
  });

  it("returns one parsed sample for every connected broker", async () => {
    const agent = await connectedAgent();

    const res = await agent.get("/api/metrics");

    expect(res.status).toBe(200);
    expect(res.body.errors).toEqual([]);
    expect(typeof res.body.sampledAt).toBe("number");
    expect(res.body.metrics).toEqual([
      expect.objectContaining({ type: "queue", name: "orders-q", brokerLabel: "EU", inbound: { current: 12, oneMinuteAverage: null } }),
      expect.objectContaining({ type: "direct-subscriber", name: "app-1", inbound: { current: 3, oneMinuteAverage: null } }),
    ]);
  });

  it("asks SEMP only for the needed attributes (select) on every list call", async () => {
    const agent = await connectedAgent();
    const fetchMock = mockBrokerFetch();
    vi.stubGlobal("fetch", fetchMock);

    await agent.get("/api/metrics");

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toHaveLength(3);
    expect(urls.every((url) => url.includes("&select="))).toBe(true);
  });

  it("502s when every broker fails", async () => {
    const agent = await connectedAgent();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));

    const res = await agent.get("/api/metrics");

    expect(res.status).toBe(502);
  });
});

describe("GET /api/metrics/consumers", () => {
  it("returns the consumer flows of the requested queue", async () => {
    const agent = await connectedAgent();

    const res = await agent.get("/api/metrics/consumers").query({ broker: "EU", type: "queue", name: "orders-q" });

    expect(res.status).toBe(200);
    expect(res.body.flows).toEqual([
      { clientName: "consumer-1", flowId: null, activityState: "active-consumer", bindTime: null, unackedMsgCount: null },
    ]);
  });

  it("400s on an invalid query and 404s on an unknown broker label", async () => {
    const agent = await connectedAgent();

    expect((await agent.get("/api/metrics/consumers").query({ broker: "EU", type: "bogus", name: "q" })).status).toBe(400);
    expect((await agent.get("/api/metrics/consumers").query({ broker: "nope", type: "queue", name: "q" })).status).toBe(404);
  });

  it("502s with the SEMP reason when the broker rejects the request", async () => {
    const agent = await connectedAgent();

    const res = await agent.get("/api/metrics/consumers").query({ broker: "EU", type: "queue", name: "unknown-q" });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/HTTP 400/);
  });
});
