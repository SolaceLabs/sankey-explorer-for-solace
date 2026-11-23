import type { ReactNode } from "react";
import type { DiagramViewMode } from "../lib/buildDisplayEdges";
import type { SortMode } from "../lib/sankeyLayout";
import { countLabel } from "../lib/countLabel";
import { ViewMenu } from "./ViewMenu";

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
  /** The live traffic menu, when the host provides live metrics. */
  liveMetrics?: ReactNode;
}

/** View and live traffic menus, counts and export for the diagram - presentational only. */
export function DiagramToolbar(props: DiagramToolbarProps) {
  const { stats } = props;
  return (
    <div className="sankey-toolbar">
      {props.leading}
      <ViewMenu
        viewMode={props.viewMode}
        onViewModeChange={props.onViewModeChange}
        showDirectSubscribers={props.showDirectSubscribers}
        onShowDirectSubscribersChange={props.onShowDirectSubscribersChange}
        sortMode={props.sortMode}
        onSortModeChange={props.onSortModeChange}
      />

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
