import { describe, expect, it } from "vitest";
import { checkBrokerUrl } from "../semp/brokerUrlPolicy.js";

const check = (u: string, allowed: string[] = []) => checkBrokerUrl(new URL(u), allowed);

describe("checkBrokerUrl - always-blocked addresses", () => {
  it.each([
    "http://169.254.169.254/latest/meta-data",
    "http://169.254.0.1:8080",
    "http://metadata.google.internal",
    "http://METADATA.GOOGLE.INTERNAL/computeMetadata/v1",
    "http://[fe80::1]:8080",
    "http://[fd00:ec2::254]",
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
