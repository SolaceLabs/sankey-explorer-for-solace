import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiRequestError } from "./api/client";
import { LoginScreen } from "./components/LoginScreen";
import { ConnectScreen } from "./components/ConnectScreen";
import { SankeyChart } from "./components/SankeyChart";
import { VpnMenu } from "./components/VpnMenu";
import { buildBrokerColorPalette } from "./lib/buildEndpointBrokerColors";
import { buildDiagramData } from "./lib/diagramData";
import type { BrokerConfigEntry } from "./lib/brokerConfig";
import type { BrokerConnectionStatus, BrokerQueryError, EndpointInfo, SessionInfo } from "./types";
import "./index.css";

type ViewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "login" }
  | { kind: "connect" }
  | { kind: "ready"; endpoints: EndpointInfo[]; errors: BrokerQueryError[] };

function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // Credentials for currently-connected brokers, kept in memory only, so the
  // Connect screen's "Export config" can save all of them at once - lifted
  // here (rather than local to ConnectScreen) so it survives navigating to
  // the diagram view and back. See ConnectScreenProps for details.
  const [brokerConfigs, setBrokerConfigs] = useState<Map<string, BrokerConfigEntry>>(new Map());
  // The header element the diagram search is portaled into (callback ref,
  // so the chart re-renders once it exists).
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);
  const [exportSlot, setExportSlot] = useState<HTMLDivElement | null>(null);

  const loadEndpoints = useCallback(async () => {
    setView({ kind: "loading" });
    try {
      const { endpoints, errors } = await api.getEndpoints();
      setView({ kind: "ready", endpoints, errors });
    } catch (err) {
      setView({
        kind: "error",
        message: err instanceof ApiRequestError ? err.message : "Failed to load endpoints",
      });
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const s = await api.getSession();
      setSession(s);
      if (s.authRequired && !s.authenticated) {
        setView({ kind: "login" });
      } else if (s.brokers.length === 0) {
        setView({ kind: "connect" });
      } else {
        await loadEndpoints();
      }
    } catch (err) {
      setView({
        kind: "error",
        message: err instanceof ApiRequestError ? err.message : "Could not reach the server",
      });
    }
  }, [loadEndpoints]);

  useEffect(() => {
    // Fetch-on-mount: loadSession only calls setState after awaiting the API, so this is
    // synchronizing with an external system (the server), not a render-time cascade.
    // oxlint-disable-next-line react/set-state-in-effect
    loadSession();
  }, [loadSession]);

  function handleBrokersChanged(brokers: BrokerConnectionStatus[]) {
    setSession((prev) =>
      prev ? { ...prev, brokers } : { authRequired: false, authenticated: true, brokers },
    );
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const { endpoints, errors } = await api.getEndpoints();
      setView({ kind: "ready", endpoints, errors });
    } catch (err) {
      setRefreshError(
        err instanceof ApiRequestError ? err.message : "Refresh failed",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleLogout() {
    await api.logout();
    await loadSession();
  }

  async function handleDisconnectAll() {
    await api.disconnectAll();
    setSession((prev) => (prev ? { ...prev, brokers: [] } : prev));
    setBrokerConfigs(new Map());
    setView({ kind: "connect" });
  }

  const brokerColors = useMemo(
    () => buildBrokerColorPalette((session?.brokers ?? []).map((b) => b.label)),
    [session?.brokers],
  );

  // One derivation per endpoints reply, not per render: the chart keys its
  // selection on these references (a failed refresh re-renders App but must
  // not drop the selection).
  const readyEndpoints = view.kind === "ready" ? view.endpoints : null;
  const diagramData = useMemo(() => readyEndpoints && buildDiagramData(readyEndpoints), [readyEndpoints]);
  const hasBrokers = Boolean(session && session.brokers.length > 0);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-icon" src="/sankey-explorer-app-icon.svg" alt="" width={34} height={34} />
          <div className="brand-text">
            <h1 className="brand-title">Sankey Explorer</h1>
            <span className="brand-subtitle">for Solace</span>
          </div>
        </div>
        {/* SankeyChart portals its search in here - see its searchSlot prop. */}
        <div className="topbar-search" ref={setSearchSlot} />
        <div className="topbar-actions">
          {session && hasBrokers && (
            <>
              <VpnMenu
                brokers={session.brokers}
                colors={brokerColors}
                onManage={() => setView({ kind: "connect" })}
                onDisconnectAll={handleDisconnectAll}
              />
              <button
                type="button"
                className="icon-button icon-button--primary"
                aria-label="Refresh"
                title="Refresh"
                aria-busy={isRefreshing}
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <svg
                  className={isRefreshing ? "icon icon--spinning" : "icon"}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                  <path d="M20 4v7h-7" />
                </svg>
              </button>
              {/* SankeyChart portals its export button in here (exportSlot). */}
              <div className="topbar-export" ref={setExportSlot} />
            </>
          )}
          {session?.authRequired && session.authenticated && (
            <button type="button" className="button button--outline" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <main>
        {view.kind === "loading" && <p className="hint">Loading...</p>}
        {view.kind === "error" && (
          <div className="screen">
            <div className="card">
              <p className="error">{view.message}</p>
              <button onClick={loadSession}>Try again</button>
            </div>
          </div>
        )}
        {view.kind === "login" && <LoginScreen onLoggedIn={loadSession} />}
        {view.kind === "connect" && (
          <ConnectScreen
            brokers={session?.brokers ?? []}
            onBrokersChanged={handleBrokersChanged}
            brokerConfigs={brokerConfigs}
            onBrokerConfigsChanged={setBrokerConfigs}
            onDone={loadEndpoints}
          />
        )}
        {view.kind === "ready" && diagramData && (
          <div className="ready-view">
            {refreshError && <p className="error banner">{refreshError}</p>}
            {view.errors.length > 0 && (
              <p className="error banner" role="alert">
                Some Message VPNs could not be loaded and are missing from the diagram:{" "}
                {view.errors.map((e) => `${e.brokerLabel} (${e.message})`).join("; ")}
              </p>
            )}
            <SankeyChart {...diagramData} searchSlot={searchSlot} exportSlot={exportSlot} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
