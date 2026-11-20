/**
 * Endpoint nodes (the rightmost column) are labeled "Queue: X",
 * "Topic Endpoint: X", or "Direct Subscriber: X".
 */
export function isEndpointNode(id: string): boolean {
  return (
    id.startsWith("Queue:") ||
    id.startsWith("Topic Endpoint:") ||
    id.startsWith("Direct Subscriber:")
  );
}

/**
 * Human-readable endpoint type for the sub-label under an endpoint's name
 * (e.g. "Queue"). Null for non-endpoint (topic hierarchy) ids.
 */
export function endpointTypeLabel(id: string): string | null {
  if (id.startsWith("Queue:")) return "Queue";
  if (id.startsWith("Topic Endpoint:")) return "Topic Endpoint";
  if (id.startsWith("Direct Subscriber:")) return "Direct Subscriber";
  return null;
}

export type EndpointTypeCode = "Q" | "TE" | "DS";

/**
 * Short badge code drawn next to an endpoint's name in the diagram (and in
 * the selection panel), so the type reads at a glance without a full
 * "Queue"/"Topic Endpoint" sub-line. Null for topic hierarchy ids.
 */
export function endpointTypeCode(id: string): EndpointTypeCode | null {
  if (id.startsWith("Queue:")) return "Q";
  if (id.startsWith("Topic Endpoint:")) return "TE";
  if (id.startsWith("Direct Subscriber:")) return "DS";
  return null;
}
