import type { EndpointMetrics, RateSample } from "../types";
import type { EndpointActivity } from "../lib/endpointActivity";
import { ACTIVITY_LABELS, formatBytes, formatPercent, formatRate } from "../lib/formatMetrics";

interface EndpointMetricsSectionProps {
  /** True once the overlay has any sample at all. */
  hasSample: boolean;
  metrics: EndpointMetrics | undefined;
  activity: EndpointActivity | undefined;
}

const rateText = (rate: RateSample): string =>
  `${formatRate(rate.current)} msg/s (1 min avg ${formatRate(rate.oneMinuteAverage)})`;

const enabledText = (value: boolean | null): string => (value === null ? "n/a" : value ? "enabled" : "disabled");

const TREND_TEXT: Record<EndpointActivity["trend"], string> = {
  growing: "growing",
  shrinking: "shrinking",
  steady: "steady",
  unknown: "n/a (needs two samples)",
};

function rows(metrics: EndpointMetrics, activity: EndpointActivity): [string, string][] {
  if (metrics.type === "direct-subscriber") {
    return [
      ["Delivered to client", rateText(metrics.inbound)],
      ["Published by client", rateText(metrics.published)],
      ["Client username", metrics.clientUsername ?? "n/a"],
    ];
  }
  const { spool } = metrics;
  return [
    ["In", rateText(metrics.inbound)],
    ["Out", rateText(metrics.outbound)],
    ["Spool usage", formatBytes(spool.usageBytes)],
    ["Quota", spool.quotaBytes === null ? "none / n/a" : `${formatBytes(spool.quotaBytes)} (${formatPercent(activity.fillRatio)} used)`],
    ["Spool trend", TREND_TEXT[activity.trend]],
    ["Unacked", spool.unackedMsgCount === null ? "n/a" : String(spool.unackedMsgCount)],
    ["Ingress / egress", `${enabledText(metrics.ingressEnabled)} / ${enabledText(metrics.egressEnabled)}`],
  ];
}

/** The live metrics block of the selection panel, for one endpoint. */
export function EndpointMetricsSection({ hasSample, metrics, activity }: EndpointMetricsSectionProps) {
  if (!hasSample) {
    return <p className="selection-panel-hint">Start live metrics in the toolbar to see rates and spool usage.</p>;
  }
  if (!metrics || !activity) {
    return <p className="selection-panel-hint">The latest live sample has no data for this endpoint.</p>;
  }
  return (
    <section className="live-metrics-section" aria-label="Live metrics">
      <h3 className="selection-section-title">
        Live metrics <span className={`pill pill--activity-${activity.status}`}>{ACTIVITY_LABELS[activity.status]}</span>
      </h3>
      <dl className="metrics-list">
        {rows(metrics, activity).map(([label, value]) => (
          <div key={label} className="metrics-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
