import { describe, expect, it } from "vitest";
import { parseConnectBody } from "../routes/connectBody.js";

const valid = { baseUrl: "http://localhost:8080", vpn: "default", username: "ro", password: "x" };

describe("parseConnectBody", () => {
  it("accepts a complete body and returns typed, trimmed-label values", () => {
    const result = parseConnectBody({ ...valid, label: "EU" });
    expect(result).toEqual({ ok: true, value: { ...valid, label: "EU" } });
  });

  it("treats the label as optional", () => {
    const result = parseConnectBody(valid);
    expect(result.ok && result.value.label).toBeUndefined();
  });

  it.each([undefined, null, "string", 42, []])("rejects a non-object body (%j)", (body) => {
    expect(parseConnectBody(body)).toEqual({
      ok: false,
      error: "baseUrl, vpn, username and password are required",
    });
  });

  it.each(["baseUrl", "vpn", "username", "password"])("requires a non-blank %s", (field) => {
    expect(parseConnectBody({ ...valid, [field]: "   " }).ok).toBe(false);
    expect(parseConnectBody({ ...valid, [field]: 5 }).ok).toBe(false);
  });

  it("rejects a non-string label", () => {
    expect(parseConnectBody({ ...valid, label: 7 })).toEqual({
      ok: false,
      error: "label must be a string",
    });
  });

  it("rejects absurdly long values", () => {
    const result = parseConnectBody({ ...valid, vpn: "v".repeat(300) });
    expect(result).toEqual({ ok: false, error: "vpn is too long (max 255 characters)" });
  });

  it("rejects a baseUrl beyond 2048 characters", () => {
    const result = parseConnectBody({ ...valid, baseUrl: "http://h/" + "a".repeat(2100) });
    expect(result.ok).toBe(false);
  });
});
