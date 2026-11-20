import type { DirectSubscriberMetrics, EndpointInfo, SpooledEndpointMetrics } from "../types";

/**
 * Builders for metric and endpoint test data (imported by tests only, so
 * it never reaches the production bundle). Defaults describe a known,
 * idle, empty endpoint; tests override just what they are about.
 */
export const queueMetrics = (overrides: Partial<SpooledEndpointMetrics> = {}): SpooledEndpointMetrics => ({
  type: "queue",
  name: "orders-q",
  brokerLabel: "default",
  inbound: { current: 0, oneMinuteAverage: 0 },
  outbound: { current: 0, oneMinuteAverage: 0 },
  spool: { usageBytes: 0, quotaBytes: 100 * 1024 * 1024, unackedMsgCount: 0 },
  ingressEnabled: true,
  egressEnabled: true,
  ...overrides,
});

export const clientMetrics = (overrides: Partial<DirectSubscriberMetrics> = {}): DirectSubscriberMetrics => ({
  type: "direct-subscriber",
  name: "app-1",
  brokerLabel: "default",
  inbound: { current: 0, oneMinuteAverage: 0 },
  published: { current: 0, oneMinuteAverage: 0 },
  clientUsername: "svc",
  ...overrides,
});

export const endpointInfo = (overrides: Partial<EndpointInfo> = {}): EndpointInfo => ({
  type: "queue",
  name: "orders-q",
  vpn: "default",
  subscriptions: ["orders/created"],
  brokerLabel: "default",
  brokerHost: "localhost:8080",
  ...overrides,
});
