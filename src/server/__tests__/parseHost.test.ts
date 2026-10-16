import { describe, expect, it } from "vitest";
import { parseHost } from "../semp/parseHost.js";

describe("parseHost", () => {
  it("extracts host and port from a valid URL", () => {
    expect(parseHost("http://localhost:8080/SEMP")).toBe("localhost:8080");
  });

  it("extracts just the host when there is no explicit port", () => {
    expect(parseHost("https://broker.example.com/SEMP")).toBe("broker.example.com");
  });

  it("falls back to the raw string for an unparseable URL", () => {
    expect(parseHost("not a url")).toBe("not a url");
  });
});
