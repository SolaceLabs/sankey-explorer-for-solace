import type { LiveStatusLine } from "../lib/formatMetrics";
import { ACTIVITY_COLORS } from "../lib/diagramColors";

type Status = LiveStatusLine["status"];

/**
 * One stroke icon per live status (24x24 grid): an arrow for "Flowing", a
 * growing stack for "Piling up", a clock for "Stale", a flat line for "Idle". Shared by the
 * diagram (inside its SVG) and the HTML legend/panel, so they always match.
 */
const ICON_PATHS: Readonly<Record<Status, string>> = {
  flowing: "M4 12h14M13 6l6 6-6 6",
  "piling-up": "M4 20h16M7 16h10M10 12h4M12 3v5",
  stale: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2",
  idle: "M5 12h14",
};

interface ActivityIconProps {
  status: Status;
  size?: number;
  /** Position when nested inside the diagram's SVG; ignored by HTML layout. */
  x?: number;
  y?: number;
}

export function ActivityIcon({ status, size = 14, x, y }: ActivityIconProps) {
  return (
    <svg
      className={`activity-icon activity-icon--${status}`}
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ACTIVITY_COLORS[status]}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[status]} />
    </svg>
  );
}
