import { useRef, useState } from "react";
import type { ReachedEndpoint, SelectionDetails } from "../lib/describeSelection";
import { endpointDisplayName } from "../lib/endpointDisplayName";
import { countLabel } from "../lib/countLabel";
import { EndpointTypeBadge } from "./EndpointTypeBadge";
import { useViewportFitHeight } from "./useViewportFitHeight";

/** Same as the panel's sticky `top` in index.css (1rem). */
const STICKY_GAP_PX = 16;

interface SelectionPanelProps {
  details: SelectionDetails;
  isFocused: boolean;
  onToggleFocus: () => void;
  onClose: () => void;
  endpointOwners?: Map<string, string>;
}

function EndpointItem({ endpoint, owner }: { endpoint: ReachedEndpoint; owner?: string }) {
  const how = endpoint.match === "subscribed" ? "Own subscription" : "Covered by a wider subscription";
  return (
    <li className="selection-item">
      <div className="selection-item-head">
        <EndpointTypeBadge endpointId={endpoint.id} />
        <span className="selection-item-name">{endpointDisplayName(endpoint.id)}</span>
        {endpoint.match === "covered" && <span className="pill pill--wildcard">Wildcard</span>}
      </div>
      <span className="selection-item-meta">{owner ? `${how}, owner ${owner}` : how}</span>
      {endpoint.subscriptions.map((sub) => (
        <code key={sub} className="selection-item-topic">
          {sub}
        </code>
      ))}
    </li>
  );
}

/**
 * The detail panel shown beside the diagram while a node is selected:
 * which endpoints a topic reaches (and whether through their own
 * subscription or wildcard coverage), or which subscriptions an endpoint
 * declares. All content comes from describeSelection.
 */
export function SelectionPanel({ details, isFocused, onToggleFocus, onClose, endpointOwners }: SelectionPanelProps) {
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const maxHeight = useViewportFitHeight(panelRef, STICKY_GAP_PX);
  const isTopic = details.kind === "topic";
  const title = isTopic ? details.id : endpointDisplayName(details.id);

  const copyTitle = async () => {
    try {
      await navigator.clipboard.writeText(title);
      setCopied(true);
    } catch {
      // Clipboard access can be denied (insecure context, permissions) -
      // the text is still selectable in the panel, so just don't confirm.
      setCopied(false);
    }
  };

  return (
    <aside ref={panelRef} className="selection-panel" aria-label="Selection details" style={{ maxHeight }}>
      <div className="selection-panel-head">
        <div className="selection-panel-title">
          <span className="selection-panel-kicker">{isTopic ? "Selected topic" : "Selected endpoint"}</span>
          <span className="selection-panel-id">
            {!isTopic && <EndpointTypeBadge endpointId={details.id} />}
            {title}
          </span>
        </div>
        <button type="button" className="icon-button icon-button--quiet" aria-label="Close details" onClick={onClose}>
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {isTopic ? (
        <>
          <p className="selection-panel-summary">
            {details.hasSubtopics ? (
              // A branch: one message only reaches some of these, depending
              // on the full topic it is published to.
              <>
                <strong>{countLabel(details.endpoints.length, "endpoint")}</strong>{" "}
                {details.endpoints.length === 1 ? "receives" : "receive"} topics from this branch.
              </>
            ) : (
              <>
                Messages published here reach <strong>{countLabel(details.endpoints.length, "endpoint")}</strong>.
              </>
            )}
          </p>
          <ul className="selection-list">
            {details.endpoints.map((endpoint) => (
              <EndpointItem key={endpoint.id} endpoint={endpoint} owner={endpointOwners?.get(endpoint.id)} />
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="selection-panel-summary">
            Declares <strong>{countLabel(details.subscriptions.length, "subscription")}</strong>
            {endpointOwners?.get(details.id) ? `, owner ${endpointOwners.get(details.id)}` : ""}.
          </p>
          <ul className="selection-list">
            {details.subscriptions.map((sub) => (
              <li key={sub} className="selection-item">
                <code className="selection-item-topic">{sub}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="selection-panel-actions">
        <button type="button" className="button button--outline" onClick={copyTitle}>
          {copied ? "Copied" : isTopic ? "Copy topic" : "Copy name"}
        </button>
        <button type="button" className="button" onClick={onToggleFocus}>
          {isFocused ? "Show all flows" : "Show only this"}
        </button>
      </div>
    </aside>
  );
}
