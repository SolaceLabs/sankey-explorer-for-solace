import type { ReactNode } from "react";
import type { DiagramViewMode } from "../lib/buildDisplayEdges";
import type { SortMode } from "../lib/sankeyLayout";
import { countLabel } from "../lib/countLabel";

export interface DiagramStats {
  topics: number;
  endpoints: number;
  /** Names of endpoints that have no subscription at all (not drawable as flows). */
  unsubscribedEndpoints: string[];
}

interface DiagramToolbarProps {
  viewMode: DiagramViewMode;
  onViewModeChange: (mode: DiagramViewMode) => void;
  showDirectSubscribers: boolean;
  onShowDirectSubscribersChange: (show: boolean) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  stats: DiagramStats;
  isFocused: boolean;
  onBackToOverview: () => void;
  /** Rendered first in the bar - the search, when no header slot hosts it. */
  leading?: ReactNode;
  /** Rendered last in the bar - the export button, when no header slot hosts it. */
  trailing?: ReactNode;
  /** The live metrics controls (start/pause, interval, status), when the host provides them. */
  liveMetrics?: ReactNode;
}

const VIEW_MODES: { value: DiagramViewMode; label: string }[] = [
  { value: "dataflow", label: "Data flow" },
  { value: "subscriptions", label: "Literal subscriptions" },
];

const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: "crossing", label: "Fewest crossings" },
  { value: "topic", label: "Topic name" },
  { value: "queue", label: "Endpoint" },
  { value: "owner", label: "Owner" },
  { value: "messageVpn", label: "Message VPN" },
];

/** Display settings, counts and export for the diagram - presentational only. */
export function DiagramToolbar(props: DiagramToolbarProps) {
  const { stats } = props;
  return (
    <div className="sankey-toolbar">
      {props.leading}
      <div className="segmented" role="group" aria-label="View">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className="segmented-option"
            aria-pressed={props.viewMode === mode.value}
            title={mode.value === "dataflow" ? "Wildcard-aware: shows what the broker delivers" : "Only the subscriptions each endpoint declares"}
            onClick={() => props.onViewModeChange(mode.value)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <label className="toolbar-toggle">
        <input
          type="checkbox"
          className="toolbar-toggle-input"
          checked={props.showDirectSubscribers}
          onChange={(e) => props.onShowDirectSubscribersChange(e.target.checked)}
        />
        <span className="toolbar-toggle-track" aria-hidden="true" />
        <span>Direct subscribers</span>
      </label>

      <label className="toolbar-control">
        <span>Sort</span>
        <select value={props.sortMode} onChange={(e) => props.onSortModeChange(e.target.value as SortMode)}>
          {SORT_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>

      {props.liveMetrics}

      <div className="toolbar-spacer" />

      <span className="toolbar-stat">
        {countLabel(stats.topics, "topic")}, {countLabel(stats.endpoints, "endpoint")}
      </span>
      {stats.unsubscribedEndpoints.length > 0 && (
        <span className="toolbar-stat toolbar-stat--warning" title={stats.unsubscribedEndpoints.join(", ")}>
          <span className="status-dot" aria-hidden="true" />
          {stats.unsubscribedEndpoints.length} without subscriptions
        </span>
      )}
      {props.isFocused && (
        <button type="button" className="toolbar-button" onClick={props.onBackToOverview}>
          Back to overview
        </button>
      )}
      {props.trailing}
    </div>
  );
}
