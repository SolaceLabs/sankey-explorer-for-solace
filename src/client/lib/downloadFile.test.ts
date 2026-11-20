import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFile } from "./downloadFile";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadFile", () => {
  it("clicks a link to a blob of the content under the given name, then frees the blob", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadFile("a: 1\n", "application/x-yaml", "config.yaml");

    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("application/x-yaml");
    expect(await blob.text()).toBe("a: 1\n");
    const clicked = click.mock.contexts[0] as HTMLAnchorElement | undefined;
    expect(clicked?.download).toBe("config.yaml");
    expect(clicked?.href).toBe("blob:mock-url");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
