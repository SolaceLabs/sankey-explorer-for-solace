/** The parts of a KeyboardEvent the shortcut check reads - keeps it unit-testable. */
export interface ShortcutKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Apple platforms use Cmd for app shortcuts; everything else uses Ctrl. */
export const isMacPlatform = (platform: string): boolean => /mac|iphone|ipad|ipod/i.test(platform);

export const searchShortcutLabel = (mac: boolean): string => (mac ? "⌘K" : "Ctrl K");

/**
 * Cmd+K (Mac) / Ctrl+K (others) focuses the diagram search. Requires the
 * platform's own modifier and no other one, so Ctrl+K on a Mac (a text
 * editing shortcut there) and Cmd+Shift+K style combos are left alone.
 */
export function isSearchShortcut(event: ShortcutKeyEvent, mac: boolean): boolean {
  if (event.key.toLowerCase() !== "k") return false;
  if (event.altKey || event.shiftKey) return false;
  return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}
