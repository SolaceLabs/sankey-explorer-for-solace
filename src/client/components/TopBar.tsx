import type { BrokerConnectionStatus } from "../types";
import { VpnMenu } from "./VpnMenu";

interface TopBarProps {
  /** Connected brokers; the VPN menu, refresh and export show only while there are any. */
  brokers: BrokerConnectionStatus[];
  brokerColors: Map<string, string>;
  showLogout: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onManageBrokers: () => void;
  onDisconnectAll: () => void;
  onLogout: () => void;
  /**
   * Callback refs for the elements SankeyChart portals its search and
   * export button into (see its searchSlot / exportSlot props).
   */
  searchSlotRef: (element: HTMLDivElement | null) => void;
  exportSlotRef: (element: HTMLDivElement | null) => void;
}

function RefreshButton({ isRefreshing, onRefresh }: { isRefreshing: boolean; onRefresh: () => void }) {
  return (
    <button
      type="button"
      className="icon-button icon-button--primary"
      aria-label="Refresh"
      title="Refresh"
      aria-busy={isRefreshing}
      onClick={onRefresh}
      disabled={isRefreshing}
    >
      <svg className={isRefreshing ? "icon icon--spinning" : "icon"} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </svg>
    </button>
  );
}

/** The app header: brand, the diagram search slot and the session actions. */
export function TopBar(props: TopBarProps) {
  const { brokers, isRefreshing } = props;
  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand-icon" src="/sankey-explorer-app-icon.svg" alt="" width={34} height={34} />
        <div className="brand-text">
          <h1 className="brand-title">Sankey Explorer</h1>
          <span className="brand-subtitle">for Solace</span>
        </div>
      </div>
      <div className="topbar-search" ref={props.searchSlotRef} />
      <div className="topbar-actions">
        {brokers.length > 0 && (
          <>
            <VpnMenu
              brokers={brokers}
              colors={props.brokerColors}
              onManage={props.onManageBrokers}
              onDisconnectAll={props.onDisconnectAll}
            />
            <RefreshButton isRefreshing={isRefreshing} onRefresh={props.onRefresh} />
            <div className="topbar-export" ref={props.exportSlotRef} />
          </>
        )}
        {props.showLogout && (
          <button type="button" className="button button--outline" onClick={props.onLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
