import { randomUUID } from "node:crypto";
import { SempV2Client } from "./client.js";
import type { BrokerConnectionStatus } from "../../shared/types.js";
import { config, SESSION_MAX_AGE_MS } from "../config.js";

export interface BrokerConnectionInput {
  baseUrl: string; // e.g. http://broker-host:8080 - the broker's SEMP management root
  vpn: string;
  username: string;
  password: string;
  /** User-friendly name for this broker (e.g. "EU-Broker"). Defaults to the VPN name if omitted. */
  label?: string;
}

interface StoredConnection extends BrokerConnectionStatus {
  client: SempV2Client;
}

/**
 * MVP: in-memory, single Node process. Sufficient for "1 instance per
 * customer/workshop". Deferred, not forgotten (promotion trigger: multiple
 * process instances behind a load balancer): swap for an external store
 * (Redis), same interface signature.
 *
 * A session can hold MULTIPLE broker connections (e.g. a customer with
 * several brokers meshed together, wanting one combined view) - keyed by a
 * generated connection id, not overwritten by subsequent connects.
 */
const connections = new Map<string, Map<string, StoredConnection>>();

/**
 * When each session's FIRST connection was added. Credentials must not outlive
 * the session cookie (SESSION_MAX_AGE_MS): express-session's MemoryStore drops
 * expired sessions silently, with no callback, so without this the passwords
 * in `connections` would stay in memory for the life of the process.
 * sweepExpiredConnections() uses it as an absolute TTL.
 */
const sessionStartedAt = new Map<string, number>();

function toStatus(conn: StoredConnection): BrokerConnectionStatus {
  return { id: conn.id, label: conn.label, vpn: conn.vpn, baseUrl: conn.baseUrl, connectedAt: conn.connectedAt };
}

export function addBrokerConnection(
  sessionId: string,
  input: BrokerConnectionInput,
): BrokerConnectionStatus {
  const id = randomUUID();
  const conn: StoredConnection = {
    id,
    label: input.label?.trim() || input.vpn,
    vpn: input.vpn,
    baseUrl: input.baseUrl,
    connectedAt: Date.now(),
    client: new SempV2Client({
      baseUrl: input.baseUrl,
      username: input.username,
      password: input.password,
      minRequestIntervalMs: config.sempMinRequestIntervalMs,
    }),
  };

  const sessionConnections = connections.get(sessionId) ?? new Map();
  sessionConnections.set(id, conn);
  connections.set(sessionId, sessionConnections);
  if (!sessionStartedAt.has(sessionId)) sessionStartedAt.set(sessionId, conn.connectedAt);

  return toStatus(conn);
}

export function removeBrokerConnection(sessionId: string, connectionId: string): boolean {
  const sessionConnections = connections.get(sessionId);
  const removed = sessionConnections?.delete(connectionId) ?? false;
  if (sessionConnections?.size === 0) clearBrokerConnections(sessionId);
  return removed;
}

export function clearBrokerConnections(sessionId: string): void {
  connections.delete(sessionId);
  sessionStartedAt.delete(sessionId);
}

/**
 * Re-keys a session's connections after express-session's regenerate() gave it
 * a new id (login does this to prevent session fixation). The start time moves
 * with them, so the TTL keeps counting from the original connect.
 */
export function moveBrokerConnections(fromSessionId: string, toSessionId: string): void {
  if (fromSessionId === toSessionId) return;
  const moved = connections.get(fromSessionId);
  if (moved) {
    connections.set(toSessionId, moved);
    connections.delete(fromSessionId);
  }
  const startedAt = sessionStartedAt.get(fromSessionId);
  if (startedAt !== undefined) {
    sessionStartedAt.set(toSessionId, startedAt);
    sessionStartedAt.delete(fromSessionId);
  }
}

/**
 * Drops (and returns the count of) sessions whose connections are older than
 * `maxAgeMs`, releasing their credentials. `now` is injectable for tests.
 */
export function sweepExpiredConnections(
  maxAgeMs: number = SESSION_MAX_AGE_MS,
  now: number = Date.now(),
): number {
  let removed = 0;
  for (const [sessionId, startedAt] of sessionStartedAt) {
    if (now - startedAt > maxAgeMs) {
      clearBrokerConnections(sessionId);
      removed++;
    }
  }
  return removed;
}

/** Runs the sweep periodically; unref'd so it never keeps the process (or a test run) alive. */
export function startConnectionSweeper(intervalMs: number = 10 * 60 * 1000): NodeJS.Timeout {
  const timer = setInterval(() => sweepExpiredConnections(), intervalMs);
  timer.unref();
  return timer;
}

export function listBrokerConnections(sessionId: string): StoredConnection[] {
  return [...(connections.get(sessionId)?.values() ?? [])];
}

/** For the "connected?" indicator in the UI - NEVER returns credentials. */
export function getBrokerConnectionsStatus(sessionId: string): BrokerConnectionStatus[] {
  return listBrokerConnections(sessionId).map(toStatus);
}
