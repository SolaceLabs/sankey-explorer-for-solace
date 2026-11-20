import { describe, expect, it } from "vitest";
import { countLabel } from "./countLabel";

describe("countLabel", () => {
  it("uses the singular for exactly one and the plural otherwise", () => {
    expect(countLabel(1, "endpoint")).toBe("1 endpoint");
    expect(countLabel(0, "endpoint")).toBe("0 endpoints");
    expect(countLabel(7, "subscription")).toBe("7 subscriptions");
  });
});
