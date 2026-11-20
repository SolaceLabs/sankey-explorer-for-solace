import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "./api/client";
import { LoginScreen } from "./components/LoginScreen";
import { ConnectScreen } from "./components/ConnectScreen";
import { SankeyChart } from "./components/SankeyChart";
import { TopBar } from "./components/TopBar";
import { buildBrokerColorPalette } from "./lib/buildEndpointBrokerColors";
import { buildDiagramData } from "./lib/diagramData";
import { buildLiveMetricsView } from "./lib/liveMetricsView";
import { useMetricsPolling } from "./components/useMetricsPolling";
import { MetricsControls } from "./components/MetricsControls";
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
  // Bumped whenever a configuration load starts (or the brokers go away):
  // live metrics polling pauses and drops its samples on every change, so
  // metrics from an older configuration are never drawn on a newer one.
  const [configGeneration, setConfigGeneration] = useState(0);
  const metricsPolling = useMetricsPolling(configGeneration);
  const startConfigLoad = useCallback(() => setConfigGeneration((g) => g + 1), []);

  const loadEndpoints = useCallback(async () => {
    startConfigLoad();
    setView({ kind: "loading" });
    try {
      const { endpoints, errors } = await api.getEndpoints();
      setView({ kind: "ready", endpoints, errors });
    } catch (err) {
      setView({
        kind: "error",
        message: apiErrorMessage(err, "Failed to load endpoints"),
      });
    }
  }, [startConfigLoad]);

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
        message: apiErrorMessage(err, "Could not reach the server"),
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
    startConfigLoad();
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const { endpoints, errors } = await api.getEndpoints();
      setView({ kind: "ready", endpoints, errors });
    } catch (err) {
      setRefreshError(
        apiErrorMessage(err, "Refresh failed"),
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleLogout() {
    startConfigLoad();
    await api.logout();
    await loadSession();
  }

  async function handleDisconnectAll() {
    startConfigLoad();
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
  const { current: currentSample, previous: previousSample } = metricsPolling.state;
  const liveMetrics = useMemo(
    () => (readyEndpoints ? buildLiveMetricsView(readyEndpoints, currentSample, previousSample) : null),
    [readyEndpoints, currentSample, previousSample],
  );

  return (
    <div className="app">
      <TopBar
        brokers={session?.brokers ?? []}
        brokerColors={brokerColors}
        showLogout={Boolean(session?.authRequired && session.authenticated)}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onManageBrokers={() => {
          // Managing connections ends this configuration's live metrics.
          startConfigLoad();
          setView({ kind: "connect" });
        }}
        onDisconnectAll={handleDisconnectAll}
        onLogout={handleLogout}
        onSearchSlotMount={setSearchSlot}
        onExportSlotMount={setExportSlot}
      />

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
            <SankeyChart
              {...diagramData}
              searchSlot={searchSlot}
              exportSlot={exportSlot}
              liveMetrics={liveMetrics}
              metricsControls={<MetricsControls polling={metricsPolling} />}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
