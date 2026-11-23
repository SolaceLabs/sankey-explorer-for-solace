import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import type { ConsumerFlow, ConsumerLookup, ConsumersResponse } from "../types";
import { countLabel } from "../lib/countLabel";

export type FetchConsumers = (lookup: ConsumerLookup, signal: AbortSignal) => Promise<ConsumersResponse>;

interface ConsumerFlowsSectionProps {
  lookup: ConsumerLookup;
  fetchConsumers?: FetchConsumers;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; flows: ConsumerFlow[] }
  | { kind: "error"; message: string };

const flowMeta = (flow: ConsumerFlow): string =>
  [flow.activityState ?? "state n/a", flow.unackedMsgCount === null ? null : `${flow.unackedMsgCount} unacked`]
    .filter(Boolean)
    .join(", ");

/**
 * Consumers bound to the selected queue or topic endpoint. SEMP v2 has no
 * bind count on the endpoint itself, only one `txFlows` request per
 * endpoint - so this loads on request instead of on every poll. Parents key
 * it by node id, so a new selection starts from "idle" again.
 */
export function ConsumerFlowsSection({ lookup, fetchConsumers = api.getConsumers }: ConsumerFlowsSectionProps) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const inFlight = useRef<AbortController | null>(null);

  // Abort a pending request when the panel closes or switches endpoint.
  useEffect(() => () => inFlight.current?.abort(), []);

  const load = async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ kind: "loading" });
    try {
      const { flows } = await fetchConsumers(lookup, controller.signal);
      if (!controller.signal.aborted) setState({ kind: "loaded", flows });
    } catch (err) {
      if (!controller.signal.aborted) setState({ kind: "error", message: apiErrorMessage(err, "Could not load consumers") });
    }
  };

  return (
    <section className="consumers-section" aria-label="Consumers">
      <div className="consumers-head">
        <h3 className="selection-section-title">
          Consumers
          {state.kind === "loaded" && <span className="selection-section-count">{countLabel(state.flows.length, "flow")}</span>}
        </h3>
        <button type="button" className="button button--outline" onClick={load} disabled={state.kind === "loading"}>
          {state.kind === "idle" ? "Load consumers" : state.kind === "loading" ? "Loading..." : "Reload"}
        </button>
      </div>
      {state.kind === "error" && <p className="error">{state.message}</p>}
      {state.kind === "loaded" && state.flows.length === 0 && <p className="selection-panel-hint">No consumer is bound.</p>}
      {state.kind === "loaded" && state.flows.length > 0 && (
        <ul className="selection-list">
          {state.flows.map((flow, i) => (
            <li key={`${flow.clientName}-${flow.flowId ?? i}`} className="selection-item">
              <span className="selection-item-name">{flow.clientName}</span>
              <span className="selection-item-meta">{flowMeta(flow)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
