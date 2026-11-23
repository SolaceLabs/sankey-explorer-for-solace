import type { DiagramViewMode } from "../lib/buildDisplayEdges";
import type { SortMode } from "../lib/sankeyLayout";
import { useDisclosure } from "./useDisclosure";

interface ViewMenuProps {
  viewMode: DiagramViewMode;
  onViewModeChange: (mode: DiagramViewMode) => void;
  showDirectSubscribers: boolean;
  onShowDirectSubscribersChange: (show: boolean) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
}

const VIEW_MODES: { value: DiagramViewMode; label: string; description: string }[] = [
  {
    value: "dataflow",
    label: "Data flow",
    description: "What the broker delivers, including what wildcards like orders/> also catch.",
  },
  {
    value: "subscriptions",
    label: "Literal subscriptions",
    description: "Only the subscriptions each endpoint declares, 1:1 as on the broker.",
  },
];

const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: "crossing", label: "Fewest crossings" },
  { value: "topic", label: "Topic name" },
  { value: "queue", label: "Endpoint name" },
  { value: "owner", label: "Owner" },
  { value: "messageVpn", label: "Message VPN" },
];

/**
 * The diagram's display settings behind one toolbar button ("View: Data
 * flow"), each option with a line of explanation instead of a bare toggle.
 * Same disclosure pattern as the Live traffic menu next to it.
 */
export function ViewMenu(props: ViewMenuProps) {
  const { open, rootRef, buttonProps, panelId } = useDisclosure();
  const current = VIEW_MODES.find((mode) => mode.value === props.viewMode) ?? VIEW_MODES[0]!;

  return (
    <div className="toolbar-menu" ref={rootRef}>
      <button {...buttonProps} type="button" className="menu-button" aria-label={`View settings: ${current.label}`}>
        <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
        View: {current.label}
        <svg className="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>
      {open && (
        <div id={panelId} className="menu-panel" role="group" aria-label="View settings">
          <fieldset className="menu-fieldset">
            <legend className="menu-title">Which flows to draw</legend>
            {VIEW_MODES.map((mode) => (
              <label key={mode.value} className="choice-card">
                <input
                  type="radio"
                  name="view-mode"
                  className="choice-card-input"
                  checked={props.viewMode === mode.value}
                  onChange={() => props.onViewModeChange(mode.value)}
                />
                <span className="choice-card-text">
                  <span className="choice-card-label">{mode.label}</span>
                  <span className="menu-hint">{mode.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="toolbar-toggle menu-row">
            <span className="menu-row-text">
              <span className="menu-row-label">Show direct subscribers</span>
              <span className="menu-hint">Clients without a queue in between</span>
            </span>
            <input
              type="checkbox"
              className="toolbar-toggle-input"
              checked={props.showDirectSubscribers}
              onChange={(e) => props.onShowDirectSubscribersChange(e.target.checked)}
            />
            <span className="toolbar-toggle-track" aria-hidden="true" />
          </label>

          <label className="toolbar-control menu-row">
            <span className="menu-row-label">Order endpoints by</span>
            <select value={props.sortMode} onChange={(e) => props.onSortModeChange(e.target.value as SortMode)}>
              {SORT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
