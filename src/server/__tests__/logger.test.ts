import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, logInfo } from "../logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function parsed(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  expect(spy).toHaveBeenCalledOnce();
  const line = spy.mock.calls[0]?.[0] as string;
  // One event per line: the line itself must be exactly one JSON document.
  expect(line).not.toContain("\n");
  return JSON.parse(line) as Record<string, unknown>;
}

describe("logInfo", () => {
  it("writes one JSON line to stdout with ISO timestamp, level and message", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logInfo("hello world");

    const event = parsed(spy);
    expect(event.level).toBe("info");
    expect(event.message).toBe("hello world");
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("cannot be used to forge extra log lines (CWE-117): newlines in input stay inside the JSON string", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logInfo('Connected to http://x (label=evil\n{"level":"error","message":"forged"})');

    const event = parsed(spy);
    expect(event.level).toBe("info");
    expect(event.message).toContain("forged"); // present as TEXT, not as a second event
  });
});

describe("logError", () => {
  it("writes one JSON line to stderr including the error's name, message and stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");

    logError("something failed", err);

    const event = parsed(spy);
    expect(event.level).toBe("error");
    expect(event.message).toBe("something failed");
    expect(event.error).toMatchObject({ name: "Error", message: "boom", stack: err.stack });
  });

  it("omits the error field when no error is given", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("no error object here");

    expect(parsed(spy)).not.toHaveProperty("error");
  });

  it("logs non-Error values (e.g. a plain string throw) as a string", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("something failed", "a plain string error");

    expect(parsed(spy).error).toBe("a plain string error");
  });
});
