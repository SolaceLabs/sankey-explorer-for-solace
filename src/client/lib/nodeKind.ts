import { ENDPOINT_TYPE_LABELS, endpointTypeOfNodeId } from "../../shared/endpointNodeId";
import type { EndpointType } from "../../shared/types";

export type EndpointTypeCode = "Q" | "TE" | "DS";

/** Badge codes per endpoint type - see endpointTypeCode. */
const TYPE_CODES: Readonly<Record<EndpointType, EndpointTypeCode>> = {
  queue: "Q",
  "topic-endpoint": "TE",
  "direct-subscriber": "DS",
};

/**
 * The endpoint type of a node id ("Queue: X", "Topic Endpoint: X",
 * "Direct Subscriber: X"), or null for a topic hierarchy node. All other
 * helpers here are derived from it.
 */
export const endpointTypeOf = (id: string): EndpointType | null => endpointTypeOfNodeId(id);

/** Endpoint nodes are the rightmost column of the diagram. */
export const isEndpointNode = (id: string): boolean => endpointTypeOf(id) !== null;

/** Human-readable type ("Queue"); null for topic hierarchy ids. */
export function endpointTypeLabel(id: string): string | null {
  const type = endpointTypeOf(id);
  return type ? ENDPOINT_TYPE_LABELS[type] : null;
}

/**
 * Short badge code drawn next to an endpoint's name in the diagram (and in
 * the selection panel), so the type reads at a glance without a full
 * "Queue"/"Topic Endpoint" sub-line. Null for topic hierarchy ids.
 */
export function endpointTypeCode(id: string): EndpointTypeCode | null {
  const type = endpointTypeOf(id);
  return type ? TYPE_CODES[type] : null;
}
