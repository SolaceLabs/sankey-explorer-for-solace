import { useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { parseBrokerConfig, serializeBrokerConfig } from "../lib/brokerConfig";
import type { BrokerConfigEntry } from "../lib/brokerConfig";
import { connectEach, withNewConnectionConfig } from "../lib/brokerConnections";
import { downloadFile } from "../lib/downloadFile";
import type { BrokerConnectionStatus } from "../types";
import { ConfigFileActions } from "./ConfigFileActions";
import { ConnectForm } from "./ConnectForm";

interface ConnectScreenProps {
  brokers: BrokerConnectionStatus[];
  onBrokersChanged: (brokers: BrokerConnectionStatus[]) => void;
  /**
   * The credentials used to add each currently-connected broker, keyed by
   * connection id - kept in memory in the browser tab only (never sent
   * anywhere, never persisted) so "Export config" can save all of them, not
   * just whatever happens to be in the form right now. Lifted up to App so
   * it survives navigating away from this screen and back.
   */
  brokerConfigs: Map<string, BrokerConfigEntry>;
  onBrokerConfigsChanged: (configs: Map<string, BrokerConfigEntry>) => void;
  onDone: () => void;
}

const connectionFailed = (err: unknown) => apiErrorMessage(err, "Connection failed");

interface BrokerListProps {
  brokers: BrokerConnectionStatus[];
  removingId: string | null;
  onRemove: (id: string) => void;
}

function BrokerList({ brokers, removingId, onRemove }: BrokerListProps) {
  return (
    <ul className="broker-list">
      {brokers.map((b) => (
        <li key={b.id}>
          <span>
            {b.label}
            <span className="hint"> — {b.vpn}</span>
          </span>
          <button type="button" onClick={() => onRemove(b.id)} disabled={removingId === b.id}>
            {removingId === b.id ? "..." : "Remove"}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Add, remove, export and import Message VPN connections. */
export function ConnectScreen({
  brokers,
  onBrokersChanged,
  brokerConfigs,
  onBrokerConfigsChanged,
  onDone,
}: ConnectScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const hasBrokers = brokers.length > 0;
  const exportableCount = brokers.filter((b) => brokerConfigs.has(b.id)).length;

  async function handleConnect(entry: BrokerConfigEntry): Promise<boolean> {
    setError(null);
    try {
      const updated = await api.connect(entry);
      onBrokersChanged(updated);
      const configs = withNewConnectionConfig(brokerConfigs, brokers, updated, entry);
      if (configs !== brokerConfigs) onBrokerConfigsChanged(new Map(configs));
      return true;
    } catch (err) {
      setError(connectionFailed(err));
      return false;
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      const updated = await api.disconnectOne(id);
      onBrokersChanged(updated);
      if (brokerConfigs.has(id)) {
        const next = new Map(brokerConfigs);
        next.delete(id);
        onBrokerConfigsChanged(next);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Could not remove the connection"));
    } finally {
      setRemovingId(null);
    }
  }

  function handleExport() {
    const entries = brokers
      .map((b) => brokerConfigs.get(b.id))
      .filter((entry): entry is BrokerConfigEntry => entry !== undefined);
    downloadFile(serializeBrokerConfig(entries), "application/x-yaml", "broker-config.yaml");
  }

  async function handleImport(file: File) {
    setError(null);
    setImporting(true);
    try {
      const entries = parseBrokerConfig(await file.text());
      const result = await connectEach(entries, { brokers, configs: brokerConfigs }, api.connect, connectionFailed);
      onBrokersChanged(result.brokers);
      onBrokerConfigsChanged(new Map(result.configs));
      if (result.failures.length > 0) {
        setError(`Some connections from the imported file failed: ${result.failures.join("; ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import config file");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="screen">
      <div className="card">
        <p className="eyebrow">Message VPN connection</p>
        <h1>{hasBrokers ? "Manage Message VPN connections" : "Connect to Message VPN"}</h1>

        {hasBrokers && <BrokerList brokers={brokers} removingId={removingId} onRemove={handleRemove} />}

        <ConnectForm isFirstConnection={!hasBrokers} error={error} onConnect={handleConnect} />

        <ConfigFileActions
          exportableCount={exportableCount}
          connectionCount={brokers.length}
          importing={importing}
          onExport={handleExport}
          onImport={handleImport}
        />

        {hasBrokers && (
          <button type="button" onClick={onDone}>
            View diagram
          </button>
        )}

        <p className="hint">
          Credentials are kept server-side for this session only - never
          stored in the browser.
        </p>
      </div>
    </div>
  );
}
