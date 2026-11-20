import { describe, expect, it } from "vitest";
import { endpointSubLines } from "./endpointSubLines";

const id = "Queue: q1";

describe("endpointSubLines", () => {
  it("lists the owner before the vpn/host", () => {
    const lines = endpointSubLines(id, { owners: new Map([[id, "alice"]]), vpnHosts: new Map([[id, "default @ b1"]]) });
    expect(lines).toEqual(["alice", "default @ b1"]);
  });

  it("leaves out whatever is unknown", () => {
    expect(endpointSubLines(id, { vpnHosts: new Map([[id, "default @ b1"]]) })).toEqual(["default @ b1"]);
    expect(endpointSubLines(id, { owners: new Map([[id, ""]]) })).toEqual([]);
    expect(endpointSubLines(id, {})).toEqual([]);
  });
});
