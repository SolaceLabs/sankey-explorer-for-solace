import { endpointTypeCode, endpointTypeLabel } from "../lib/nodeKind";

interface EndpointTypeBadgeProps {
  endpointId: string;
}

/**
 * HTML version of the Q / TE / DS badge (the diagram draws its own SVG
 * twin, see SankeyChart). The full type name is the accessible name, so a
 * screen reader hears "Queue", not "Q".
 */
export function EndpointTypeBadge({ endpointId }: EndpointTypeBadgeProps) {
  const code = endpointTypeCode(endpointId);
  if (!code) return null;
  const label = endpointTypeLabel(endpointId) ?? code;
  return (
    <span className={`type-badge type-badge--${code.toLowerCase()}`} title={label}>
      <span aria-hidden="true">{code}</span>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
