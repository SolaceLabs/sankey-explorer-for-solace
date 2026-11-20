import type { MetricsPolling } from "./useMetricsPolling";
import { POLL_INTERVALS_MS, type PollIntervalMs } from "../lib/metricsPolling";
import { ACTIVITY_LABELS, formatSampleTime } from "../lib/formatMetrics";

interface MetricsControlsProps {
  polling: MetricsPolling;
}

const LEGEND = ["active", "backlog", "idle"] as const;

/** "Last poll failed: x" and/or the brokers missing from an otherwise good sample. */
function problemText({ state }: MetricsPolling): string | null {
  const problems: string[] = [];
  if (state.error) problems.push(`Last poll failed: ${state.error}`);
  const brokerErrors = state.current?.errors ?? [];
  if (brokerErrors.length > 0) {
    problems.push(`No metrics from ${brokerErrors.map((e) => `${e.brokerLabel} (${e.message})`).join(", ")}`);
  }
  return problems.length > 0 ? problems.join(". ") : null;
}

function statusText({ state }: MetricsPolling): string {
  const mode = state.status === "running" ? "Live" : "Paused";
  return state.lastSuccessAt === null ? mode : `${mode} · updated ${formatSampleTime(state.lastSuccessAt)}`;
}

/**
 * Toolbar group for the live metrics overlay: start/pause, interval,
 * "Refresh now", the polling state with the time of the last good sample,
 * and any transient problem (which never clears the last good sample).
 */
export function MetricsControls({ polling }: MetricsControlsProps) {
  const { state } = polling;
  const running = state.status === "running";
  const problem = problemText(polling);

  return (
    <div className="live-metrics" role="group" aria-label="Live metrics">
      <button
        type="button"
        className={running ? "icon-button icon-button--primary" : "icon-button icon-button--outline"}
        aria-label={running ? "Pause live metrics" : "Start live metrics"}
        title={running ? "Pause live metrics" : "Start live metrics"}
        aria-pressed={running}
        onClick={running ? polling.pause : polling.start}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="icon">
          {running ? <path d="M8 5v14M16 5v14" /> : <path d="M7 5l12 7-12 7z" />}
        </svg>
      </button>

      <label className="toolbar-control">
        <span>Every</span>
        <select
          aria-label="Live metrics interval"
          value={state.intervalMs}
          onChange={(e) => polling.setIntervalMs(Number(e.target.value) as PollIntervalMs)}
        >
          {POLL_INTERVALS_MS.map((ms) => (
            <option key={ms} value={ms}>
              {ms / 1000} s
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="icon-button icon-button--quiet"
        aria-label="Refresh metrics now"
        title="Refresh metrics now"
        aria-busy={state.isFetching}
        disabled={state.isFetching}
        onClick={polling.refreshNow}
      >
        <svg className={state.isFetching ? "icon icon--spinning" : "icon"} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
      </button>

      <span className={`toolbar-stat live-metrics-status live-metrics-status--${state.status}`} role="status">
        <span className="status-dot" aria-hidden="true" />
        {statusText(polling)}
      </span>

      {problem && (
        <span className="toolbar-stat toolbar-stat--warning live-metrics-problem" title={problem}>
          <span className="status-dot" aria-hidden="true" />
          <span className="live-metrics-problem-text">{problem}</span>
        </span>
      )}

      {state.current && (
        <span className="live-legend" aria-label="Legend">
          {LEGEND.map((status) => (
            <span key={status} className="live-legend-item">
              <span className={`live-legend-dot live-legend-dot--${status}`} aria-hidden="true" />
              {ACTIVITY_LABELS[status]}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
