import { describe, expect, it } from "vitest";
import { isMacPlatform, isSearchShortcut, searchShortcutLabel } from "./searchShortcut";

const key = (overrides: Partial<Parameters<typeof isSearchShortcut>[0]>) => ({
  key: "k",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe("isMacPlatform", () => {
  it("recognizes Apple platforms", () => {
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("iPad")).toBe(true);
  });

  it("treats everything else as non-Mac", () => {
    expect(isMacPlatform("Win32")).toBe(false);
    expect(isMacPlatform("Linux x86_64")).toBe(false);
    expect(isMacPlatform("")).toBe(false);
  });
});

describe("searchShortcutLabel", () => {
  it("shows the command symbol on a Mac and Ctrl elsewhere", () => {
    expect(searchShortcutLabel(true)).toBe("⌘K");
    expect(searchShortcutLabel(false)).toBe("Ctrl K");
  });
});

describe("isSearchShortcut", () => {
  it("accepts Cmd+K on a Mac and Ctrl+K elsewhere, case-insensitively", () => {
    expect(isSearchShortcut(key({ metaKey: true }), true)).toBe(true);
    expect(isSearchShortcut(key({ metaKey: true, key: "K" }), true)).toBe(true);
    expect(isSearchShortcut(key({ ctrlKey: true }), false)).toBe(true);
  });

  it("rejects the other platform's modifier, extra modifiers and other keys", () => {
    expect(isSearchShortcut(key({ ctrlKey: true }), true)).toBe(false);
    expect(isSearchShortcut(key({ metaKey: true }), false)).toBe(false);
    expect(isSearchShortcut(key({ metaKey: true, altKey: true }), true)).toBe(false);
    expect(isSearchShortcut(key({ metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isSearchShortcut(key({ metaKey: true, key: "j" }), true)).toBe(false);
    expect(isSearchShortcut(key({}), true)).toBe(false);
  });
});
