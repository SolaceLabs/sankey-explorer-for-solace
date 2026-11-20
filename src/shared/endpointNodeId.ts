import type { EndpointType } from "./types.js";

/**
 * The one table behind endpoint node ids. toSankeyEdges builds ids as
 * "<label>: <name>[ (<broker>)]" from it, and the client reads the type back
 * from the same table - so a new endpoint type or a renamed label can never
 * leave producer and readers out of step.
 */
export const ENDPOINT_TYPE_LABELS: Readonly<Record<EndpointType, string>> = {
  queue: "Queue",
  "topic-endpoint": "Topic Endpoint",
  "direct-subscriber": "Direct Subscriber",
};

const ENTRIES = Object.entries(ENDPOINT_TYPE_LABELS) as [EndpointType, string][];

/** The endpoint type encoded in a node id, or null for a topic hierarchy node. */
export function endpointTypeOfNodeId(id: string): EndpointType | null {
  const entry = ENTRIES.find(([, label]) => id.startsWith(`${label}:`));
  return entry ? entry[0] : null;
}

/** The id without its "<label>: " prefix; topic ids are returned unchanged. */
export function stripEndpointTypePrefix(id: string): string {
  const type = endpointTypeOfNodeId(id);
  if (!type) return id;
  return id.slice(ENDPOINT_TYPE_LABELS[type].length + 1).trimStart();
}
