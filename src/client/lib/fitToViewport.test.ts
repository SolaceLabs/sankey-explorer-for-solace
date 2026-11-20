import { describe, expect, it } from "vitest";
import { viewportFitHeight } from "./fitToViewport";

describe("viewportFitHeight", () => {
  it("fills the space from the panel's top down to the window edge, minus the gap", () => {
    // Below the header: starts at 145px in a 620px window -> 620 - 145 - 16.
    expect(viewportFitHeight(620, 145, 16)).toBe(459);
  });

  it("uses the sticky offset once the panel is pinned (or scrolled past it)", () => {
    expect(viewportFitHeight(620, 16, 16)).toBe(588);
    expect(viewportFitHeight(620, -200, 16)).toBe(588);
  });

  it("never goes below a usable minimum on tiny windows", () => {
    expect(viewportFitHeight(300, 280, 16)).toBe(240);
  });
});
