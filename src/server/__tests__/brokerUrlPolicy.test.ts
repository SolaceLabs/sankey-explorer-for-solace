import { describe, expect, it, vi } from "vitest";
import { checkBrokerUrl, checkResolvedBrokerHost } from "../semp/brokerUrlPolicy.js";

const check = (u: string, allowed: string[] = []) => checkBrokerUrl(new URL(u), allowed);

describe("checkBrokerUrl - always-blocked addresses", () => {
  it.each([
    "http://169.254.169.254/latest/meta-data",
    "http://169.254.0.1:8080",
    "http://metadata.google.internal",
    "http://METADATA.GOOGLE.INTERNAL/computeMetadata/v1",
    "http://[fe80::1]:8080",
    "http://[fd00:ec2::254]",
    "http://[febf::1]",
    // IPv4-mapped IPv6: the URL parser rewrites these to [::ffff:a9fe:a9fe],
    // which a dotted-quad check never sees - and the OS still connects to
    // 169.254.169.254 for it.
    "http://[::ffff:169.254.169.254]/latest/meta-data",
    "http://[::ffff:a9fe:a9fe]:8080",
    "http://[0:0:0:0:0:ffff:169.254.169.254]",
  ])("rejects %s", (u) => {
    expect(check(u)).toMatch(/link-local|metadata/);
  });

  it.each([
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://10.0.0.5:8080",
    "https://broker.example.com:943",
    "http://169.253.1.1",
    "http://169.254.example.com",
    "http://[::1]:8080",
    "http://[::ffff:10.0.0.5]:8080",
  ])("allows %s when no allowlist is set", (u) => {
    expect(check(u)).toBeNull();
  });
});

describe("checkBrokerUrl - allowlist", () => {
  it("allows a host on the list, with or without port", () => {
    expect(check("http://broker-a:8080", ["broker-a:8080"])).toBeNull();
    expect(check("http://broker-a:8080", ["broker-a"])).toBeNull();
  });

  it("compares case-insensitively", () => {
    expect(check("http://Broker-A:8080", ["broker-a:8080"])).toBeNull();
  });

  it("rejects a host that is not on the list", () => {
    expect(check("http://other:8080", ["broker-a:8080"])).toMatch(/ALLOWED_BROKER_HOSTS/);
  });

  it("rejects the wrong port when the entry names a port", () => {
    expect(check("http://broker-a:9999", ["broker-a:8080"])).toMatch(/ALLOWED_BROKER_HOSTS/);
  });

  it("still blocks metadata addresses even if explicitly allowlisted", () => {
    expect(check("http://169.254.169.254", ["169.254.169.254"])).toMatch(/link-local/);
  });
});

describe("checkResolvedBrokerHost - what the hostname resolves to", () => {
  const resolvesTo =
    (...addresses: string[]) =>
    () =>
      Promise.resolve(addresses.map((address) => ({ address })));

  it("rejects a hostname that resolves to a link-local address", async () => {
    await expect(checkResolvedBrokerHost("evil.example", resolvesTo("169.254.169.254"))).resolves.toMatch(
      /resolves to a link-local/,
    );
  });

  it("rejects when ANY resolved address is blocked, including IPv4-mapped IPv6", async () => {
    await expect(
      checkResolvedBrokerHost("evil.example", resolvesTo("10.0.0.5", "::ffff:169.254.169.254")),
    ).resolves.toMatch(/resolves to a link-local/);
  });

  it("allows a hostname that resolves only to ordinary addresses", async () => {
    await expect(checkResolvedBrokerHost("broker.example", resolvesTo("10.0.0.5", "fd12::5"))).resolves.toBeNull();
  });

  it("does not look up IP literals (checkBrokerUrl already judged them)", async () => {
    const lookup = vi.fn(resolvesTo("169.254.169.254"));
    await expect(checkResolvedBrokerHost("10.0.0.5", lookup)).resolves.toBeNull();
    await expect(checkResolvedBrokerHost("[::1]", lookup)).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("leaves an unresolvable hostname to the connection test, which reports the real error", async () => {
    const lookup = () => Promise.reject(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }));
    await expect(checkResolvedBrokerHost("no-such-host", lookup)).resolves.toBeNull();
  });
});
