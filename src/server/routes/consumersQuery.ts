/**
 * Validation of GET /api/metrics/consumers's query string - a pure function
 * (parse, don't cast), mirroring connectBody.ts.
 */
import type { SpooledEndpointMetrics } from "../../shared/metrics.js";

export interface ConsumersQuery {
  brokerLabel: string;
  type: SpooledEndpointMetrics["type"];
  name: string;
}

export type ConsumersQueryResult = { ok: true; value: ConsumersQuery } | { ok: false; error: string };

const MAX_FIELD_LENGTH = 255;
const ENDPOINT_TYPES: readonly SpooledEndpointMetrics["type"][] = ["queue", "topic-endpoint"];

const isBoundedString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= MAX_FIELD_LENGTH;

const isEndpointType = (value: unknown): value is SpooledEndpointMetrics["type"] =>
  ENDPOINT_TYPES.includes(value as SpooledEndpointMetrics["type"]);

/** Never throws, whatever the query holds (arrays from repeated keys, nested objects, nothing). */
export function parseConsumersQuery(query: unknown): ConsumersQueryResult {
  if (typeof query !== "object" || query === null) {
    return { ok: false, error: "broker, type and name are required" };
  }
  const { broker, type, name } = query as Record<string, unknown>;
  if (!isBoundedString(broker) || !isBoundedString(name)) {
    return { ok: false, error: `broker and name are required (max ${MAX_FIELD_LENGTH} characters each)` };
  }
  if (!isEndpointType(type)) {
    return { ok: false, error: `type must be one of: ${ENDPOINT_TYPES.join(", ")}` };
  }
  return { ok: true, value: { brokerLabel: broker, type, name } };
}
