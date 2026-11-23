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
  onSearchSlotMount: (element: HTMLDivElement | null) => void;
  onExportSlotMount: (element: HTMLDivElement | null) => void;
  /** Makes the logo and title a button back to the unfiltered diagram; omitted while there is none. */
  onShowOverview?: () => void;
}

function Brand({ onShowOverview }: Pick<TopBarProps, "onShowOverview">) {
  const content = (
    <>
      <img className="brand-icon" src="/sankey-explorer-app-icon.svg" alt="" width={34} height={34} />
      <span className="brand-text">
        <span className="brand-title">Sankey Explorer</span>
        <span className="brand-subtitle">for Solace</span>
      </span>
    </>
  );
  return (
    <h1 className="brand">
      {onShowOverview ? (
        <button
          type="button"
          className="brand-button"
          aria-label="Sankey Explorer for Solace: back to the overview"
          title="Back to the overview"
          onClick={onShowOverview}
        >
          {content}
        </button>
      ) : (
        content
      )}
    </h1>
  );
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
export function TopBar({
  brokers,
  brokerColors,
  showLogout,
  isRefreshing,
  onRefresh,
  onManageBrokers,
  onDisconnectAll,
  onLogout,
  onSearchSlotMount,
  onExportSlotMount,
  onShowOverview,
}: TopBarProps) {
  return (
    <header className="topbar">
      <Brand onShowOverview={onShowOverview} />
      <div className="topbar-search" ref={onSearchSlotMount} />
      <div className="topbar-actions">
        {brokers.length > 0 && (
          <>
            <VpnMenu
              brokers={brokers}
              colors={brokerColors}
              onManage={onManageBrokers}
              onDisconnectAll={onDisconnectAll}
            />
            <RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
            <div className="topbar-export" ref={onExportSlotMount} />
          </>
        )}
        {showLogout && (
          <button type="button" className="button button--outline" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
