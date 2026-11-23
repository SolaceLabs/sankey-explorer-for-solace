import { useEffect, useState } from "react";
import type { MetricsPolling, UpdateChoice } from "./useMetricsPolling";
import { useDisclosure } from "./useDisclosure";
import { ActivityIcon } from "./ActivityIcon";
import { POLL_INTERVALS_MS } from "../lib/metricsPolling";
import { liveProblemText } from "../lib/liveMetricsView";
import { ACTIVITY_DESCRIPTIONS, ACTIVITY_LABELS, formatSampleTime, type LiveStatusLine } from "../lib/formatMetrics";

interface LiveTrafficMenuProps {
  polling: MetricsPolling;
}

const CHOICES: { value: UpdateChoice; label: string }[] = [
  { value: "off", label: "Off" },
  ...POLL_INTERVALS_MS.map((ms) => ({ value: ms, label: `${ms / 1000} s` })),
];

const LEGEND: LiveStatusLine["status"][] = ["flowing", "piling-up", "idle"];

/** Re-renders once a second while mounted - only for the countdown in the open panel. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function UpdateTiming({ polling }: LiveTrafficMenuProps) {
  const now = useNow();
  const { lastSuccessAt, nextPollAt, isFetching } = polling.state;
  const parts = [lastSuccessAt === null ? "No update yet" : `Last update ${formatSampleTime(lastSuccessAt)}`];
  if (isFetching) parts.push("updating…");
  else if (nextPollAt !== null) parts.push(`next in ${Math.max(0, Math.ceil((nextPollAt - now) / 1000))} s`);
  return <span>{parts.join(" · ")}</span>;
}

/**
 * The live metrics settings behind one toolbar button whose label always
 * says what is going on ("Live traffic: every 15 s" / "off"). Inside: what
 * the feature does, ONE choice for "Update automatically" (Off or an
 * interval - no separate on/off switch to get out of step with it), the
 * update timing with "Update now", and what Flowing / Piling up / Idle mean.
 */
export function LiveTrafficMenu({ polling }: LiveTrafficMenuProps) {
  const { open, rootRef, buttonProps, panelId } = useDisclosure();
  const { state } = polling;
  const running = state.status === "running";
  const choice: UpdateChoice = running ? state.intervalMs : "off";
  const summary = running ? `every ${state.intervalMs / 1000} s` : "off";
  const problem = liveProblemText(state);

  return (
    <div className="toolbar-menu live-traffic" ref={rootRef}>
      <button
        {...buttonProps}
        type="button"
        className={running ? "menu-button menu-button--live" : "menu-button"}
        aria-label={`Live traffic: ${summary}`}
      >
        <span className={running ? "live-dot live-dot--on" : "live-dot"} aria-hidden="true" />
        Live traffic: {summary}
        <svg className="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>

      <span className="toolbar-stat live-traffic-status" role="status">
        {state.lastSuccessAt === null ? "" : `Updated ${formatSampleTime(state.lastSuccessAt)}`}
      </span>
      {problem && (
        <span className="toolbar-stat toolbar-stat--warning live-traffic-problem" title={problem}>
          <span className="status-dot" aria-hidden="true" />
          <span className="live-traffic-problem-text">{problem}</span>
        </span>
      )}

      {open && (
        <div id={panelId} className="menu-panel" role="group" aria-label="Live traffic settings">
          <div className="menu-intro">
            <span className="menu-title">Live traffic from the broker</span>
            <span className="menu-hint">Reads message rates and queue fill levels via SEMP and shows them on the diagram.</span>
          </div>

          <fieldset className="menu-fieldset">
            <legend className="menu-row-label">Update automatically</legend>
            <div className="choice-tiles">
              {CHOICES.map((option) => (
                <label key={option.value} className={option.value === "off" ? "choice-tile choice-tile--off" : "choice-tile"}>
                  <input
                    type="radio"
                    name="live-update"
                    className="choice-tile-input"
                    checked={choice === option.value}
                    onChange={() => polling.choose(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <span className="menu-hint">Off keeps the last numbers on the diagram.</span>
          </fieldset>

          <div className="menu-timing">
            <UpdateTiming polling={polling} />
            <button type="button" className="button button--outline" onClick={polling.refreshNow} disabled={state.isFetching}>
              Update now
            </button>
          </div>

          {problem && <p className="error menu-problem">{problem}</p>}

          <ul className="menu-legend" aria-label="What the labels mean">
            {LEGEND.map((status) => (
              <li key={status} className="menu-legend-item">
                <ActivityIcon status={status} />
                <span>
                  <strong className={`activity-label activity-label--${status}`}>{ACTIVITY_LABELS[status]}</strong>:{" "}
                  {ACTIVITY_DESCRIPTIONS[status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
