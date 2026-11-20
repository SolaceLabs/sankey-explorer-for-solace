import { describe, expect, it, vi } from "vitest";
import type { BrokerConnectionStatus } from "../types";
import type { BrokerConfigEntry } from "./brokerConfig";
import { connectEach, newConnectionId, withNewConnectionConfig } from "./brokerConnections";

const broker = (id: string): BrokerConnectionStatus => ({
  id,
  label: id,
  vpn: "default",
  baseUrl: "http://localhost:8080",
  connectedAt: 0,
});
const entry = (label: string): BrokerConfigEntry => ({
  baseUrl: "http://localhost:8080",
  vpn: "default",
  username: "u",
  password: "p",
  label,
});

describe("newConnectionId", () => {
  it("finds the one id that was added", () => {
    expect(newConnectionId([broker("a")], [broker("a"), broker("b")])).toBe("b");
  });

  it("is undefined when nothing was added (e.g. a reconnect of the same VPN)", () => {
    expect(newConnectionId([broker("a")], [broker("a")])).toBeUndefined();
  });
});

describe("withNewConnectionConfig", () => {
  it("stores the entry under the new id without touching the input map", () => {
    const configs = new Map<string, BrokerConfigEntry>();
    const next = withNewConnectionConfig(configs, [], [broker("a")], entry("A"));
    expect(next.get("a")).toEqual(entry("A"));
    expect(configs.size).toBe(0);
  });

  it("returns the same map when no connection was added", () => {
    const configs = new Map<string, BrokerConfigEntry>();
    expect(withNewConnectionConfig(configs, [broker("a")], [broker("a")], entry("A"))).toBe(configs);
  });
});

describe("connectEach", () => {
  it("connects every entry in order and remembers each one's credentials", async () => {
    const connect = vi.fn().mockResolvedValueOnce([broker("a")]).mockResolvedValueOnce([broker("a"), broker("b")]);
    const result = await connectEach([entry("A"), entry("B")], { brokers: [], configs: new Map() }, connect, String);
    expect(connect.mock.calls.map(([e]) => (e as BrokerConfigEntry).label)).toEqual(["A", "B"]);
    expect(result.brokers.map((b) => b.id)).toEqual(["a", "b"]);
    expect([...result.configs.keys()]).toEqual(["a", "b"]);
    expect(result.failures).toEqual([]);
  });

  it("keeps going past a failure and reports it by label", async () => {
    const connect = vi.fn().mockRejectedValueOnce(new Error("bad credentials")).mockResolvedValueOnce([broker("b")]);
    const result = await connectEach(
      [entry("Bad"), entry("B")],
      { brokers: [], configs: new Map() },
      connect,
      (err) => (err as Error).message,
    );
    expect(result.failures).toEqual(["Bad: bad credentials"]);
    expect(result.brokers.map((b) => b.id)).toEqual(["b"]);
  });
});
