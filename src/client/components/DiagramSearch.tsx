import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { findNodeByQuery } from "../lib/findNodeByQuery";
import { suggestNodes, type NodeSuggestion } from "../lib/suggestNodes";
import { endpointTypeLabel } from "../lib/nodeKind";
import { isMacPlatform, isSearchShortcut, searchShortcutLabel } from "../lib/searchShortcut";
import { EndpointTypeBadge } from "./EndpointTypeBadge";

interface DiagramSearchProps {
  nodeIds: readonly string[];
  onFind: (nodeId: string) => void;
}

const currentPlatform = (): string =>
  typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent;

/**
 * Pill-shaped search for a topic or endpoint, built as an ARIA combobox
 * (list autocomplete) with its own suggestion list right below the field -
 * not a native <datalist>, which browsers render unstyled and place
 * differently. Arrow keys move through the suggestions, Enter picks the
 * active one (or the best match for the typed text, see findNodeByQuery),
 * Escape closes the list, Cmd+K / Ctrl+K focuses the field from anywhere.
 * A hit clears the field and releases focus; a miss keeps the typed text
 * so it can be corrected instead of retyped.
 */
export function DiagramSearch({ nodeIds, onFind }: DiagramSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [notFound, setNotFound] = useState<string | null>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const mac = useMemo(() => isMacPlatform(currentPlatform()), []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isSearchShortcut(event, mac)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mac]);

  const suggestions = useMemo(() => suggestNodes(nodeIds, query), [nodeIds, query]);
  const expanded = listOpen && suggestions.length > 0;

  const closeList = () => {
    setListOpen(false);
    setActiveIndex(-1);
  };

  // After a hit the selection panel shows what was picked, so the field is
  // cleared and let go (it shrinks back; Cmd/Ctrl+K brings it back).
  const finish = (nodeId: string) => {
    setQuery("");
    setNotFound(null);
    closeList();
    inputRef.current?.blur();
    onFind(nodeId);
  };

  const choose = (suggestion: NodeSuggestion) => finish(suggestion.id);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = suggestions.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (count === 0) return;
      event.preventDefault();
      setListOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + count) % count);
      return;
    }
    if (event.key === "Escape" && expanded) {
      // Also stops the browser's own "Escape clears a search field".
      event.preventDefault();
      closeList();
      return;
    }
    const active = expanded ? suggestions[activeIndex] : undefined;
    if (event.key === "Enter" && active) {
      event.preventDefault();
      choose(active);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    closeList();
    const match = findNodeByQuery(nodeIds, query);
    if (!match) {
      setNotFound(query.trim() || null);
      return;
    }
    finish(match);
  };

  return (
    <form className="diagram-search" role="search" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor={`${baseId}-input`}>
        Find topic or endpoint
      </label>
      <svg className="icon diagram-search-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </svg>
      <input
        ref={inputRef}
        id={`${baseId}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        value={query}
        placeholder="Find topic or endpoint"
        aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
        aria-invalid={notFound ? true : undefined}
        aria-describedby={notFound ? `${baseId}-hint` : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setListOpen(true);
          setActiveIndex(-1);
          if (notFound) setNotFound(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={closeList}
      />
      <kbd className="diagram-search-kbd" aria-hidden="true">
        {searchShortcutLabel(mac)}
      </kbd>
      {expanded && (
        <ul id={listId} role="listbox" aria-label="Suggestions" className="diagram-search-list">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              aria-label={
                suggestion.isEndpoint
                  ? `${suggestion.label} (${endpointTypeLabel(suggestion.id) ?? "Endpoint"})`
                  : undefined
              }
              className="diagram-search-option"
              // Keep focus in the input, so onBlur doesn't close the list
              // before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(suggestion)}
            >
              {suggestion.isEndpoint ? (
                <>
                  <EndpointTypeBadge endpointId={suggestion.id} />
                  <span className="diagram-search-option-name">{suggestion.label}</span>
                </>
              ) : (
                <span className="diagram-search-option-topic">{suggestion.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* A miss keeps the typed text for correcting. No visible message by
          design - only screen readers hear it, so they still get feedback. */}
      {notFound && (
        <p id={`${baseId}-hint`} className="visually-hidden" role="status">
          No topic or endpoint matches "{notFound}"
        </p>
      )}
    </form>
  );
}
