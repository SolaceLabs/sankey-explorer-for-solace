import { useState, type FormEvent } from "react";
import type { BrokerConfigEntry } from "../lib/brokerConfig";

interface ConnectFormProps {
  /** True while no Message VPN is connected yet: shows the setup hints. */
  isFirstConnection: boolean;
  error: string | null;
  /** Resolves true once connected; the form then clears the credentials. */
  onConnect: (entry: BrokerConfigEntry) => Promise<boolean>;
}

// Defaults to host.docker.internal rather than localhost because the
// overwhelmingly common case is running THIS app itself via the Docker
// quickstart (see README) - inside that container, "localhost" is the
// container itself, not the host a locally-running broker's management
// port is published on. See the hint text below for when to override this
// (local non-Docker dev, or a broker that's neither on the host nor
// reachable via host.docker.internal).
const DEFAULT_BASE_URL = "http://host.docker.internal:8080";

function FirstConnectionHints() {
  return (
    <>
      <p className="hint">
        The broker's SEMP management host, e.g. http://broker-host:8080
        (SEMP v2 - no path needed). A read-only user is enough.
      </p>
      {/* The rest only matters in some setups - folded away so the
          form itself stays the first thing on the card. */}
      <details>
        <summary>Several Message VPNs, or which host to enter?</summary>
        <p>
          Connecting to several message VPNs (maybe across multiple
          brokers)? Add each one here - they'll all show up combined in
          the diagram, color-coded by message VPN.
        </p>
        <p>
          Pre-filled with <code>host.docker.internal</code> since
          that's what reaches a broker on your own machine from inside
          this app's own Docker container (the quickstart way of
          running it) - running this app locally instead (<code>npm run dev</code>),
          or a broker on a different host entirely? Change it to{" "}
          <code>localhost</code> or the broker's real address.
        </p>
      </details>
    </>
  );
}

/** The form that adds one Message VPN connection. */
export function ConnectForm({ isFirstConnection, error, onConnect }: ConnectFormProps) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [vpn, setVpn] = useState("default");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const connected = await onConnect({ baseUrl, vpn, username, password, label: label.trim() || undefined });
      if (!connected) return;
      // Clear credentials/label so a second broker isn't accidentally
      // submitted with the first one's password; keep URL/VPN since a
      // mesh of brokers often shares a similar SEMP host pattern.
      setUsername("");
      setPassword("");
      setLabel("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="connect-form">
      {isFirstConnection && <FirstConnectionHints />}
      <label>
        SEMP host
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://broker-host:8080"
          required
        />
      </label>
      <label>
        Message VPN
        <input value={vpn} onChange={(e) => setVpn(e.target.value)} required />
      </label>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label>
        Label (optional)
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={vpn || "e.g. EU-VPN"} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Connecting..." : isFirstConnection ? "Connect" : "Add Message VPN"}
      </button>
    </form>
  );
}
