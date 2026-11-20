import { useEffect, useId, useRef, useState } from "react";
import type { BrokerConnectionStatus } from "../types";

interface VpnMenuProps {
  brokers: BrokerConnectionStatus[];
  /** Broker label -> its color, same palette the diagram uses. */
  colors: Map<string, string>;
  onManage: () => void;
  onDisconnectAll: () => void;
}

const hostOf = (baseUrl: string): string => {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
};

/**
 * The connected Message VPNs as one compact chip in the top bar; it opens
 * a small panel listing each connection with "Manage" and "Disconnect all".
 * A disclosure (button + panel), not an ARIA menu - its content is a list
 * plus ordinary buttons. Closes on Escape, an outside click, or an action.
 */
export function VpnMenu({ brokers, colors, onManage, onDisconnectAll }: VpnMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const summary = brokers.length === 1 ? brokers[0]!.label : `${brokers.length} Message VPNs`;

  return (
    <div className="vpn-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="vpn-chip"
        aria-label={`Message VPNs: ${summary}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="vpn-chip-dots" aria-hidden="true">
          {brokers.slice(0, 3).map((b) => (
            <span key={b.id} className="vpn-dot" style={{ background: colors.get(b.label) }} />
          ))}
        </span>
        {summary}
        <svg className="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={panelId} className="vpn-panel">
          <ul className="vpn-list">
            {brokers.map((b) => (
              <li key={b.id} className="vpn-list-item">
                <span className="vpn-dot" style={{ background: colors.get(b.label) }} aria-hidden="true" />
                <span className="vpn-list-name">{b.label}</span>
                <span className="vpn-list-host">
                  {b.vpn} at {hostOf(b.baseUrl)}
                </span>
              </li>
            ))}
          </ul>
          <div className="vpn-panel-actions">
            <button type="button" className="button button--outline" onClick={run(onManage)}>
              Manage Message VPNs
            </button>
            <button type="button" className="button button--danger" onClick={run(onDisconnectAll)}>
              Disconnect all Message VPNs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
