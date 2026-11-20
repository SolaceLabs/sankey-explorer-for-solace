import { SempError, type SempV2Client } from "./client.js";
import { logError } from "../logger.js";
import type { BrokerQueryError } from "../../shared/types.js";

/**
 * What a route needs from a broker connection to query it - a structural
 * subset of connectionStore.ts's (unexported) StoredConnection, so
 * listBrokerConnections()'s result can be passed straight in without any
 * adapting.
 */
export interface FetchableBrokerConnection {
  client: SempV2Client;
  vpn: string;
  label: string;
  baseUrl: string;
}

export interface AcrossConnectionsResult<T> {
  items: T[];
  errors: BrokerQueryError[];
}

/**
 * Runs `query` against every given broker connection in parallel and
 * concatenates the results.
 *
 * One failing broker does not fail the others: its error is reported in
 * `errors` (SEMP errors by message, anything unexpected as a generic string
 * so internals never reach the client) and the rest still come back.
 * Shared by the endpoints (configuration) and metrics (telemetry) fetches.
 */
export async function queryAcrossConnections<T>(
  connections: FetchableBrokerConnection[],
  query: (conn: FetchableBrokerConnection) => Promise<T[]>,
): Promise<AcrossConnectionsResult<T>> {
  const settled = await Promise.allSettled(connections.map(query));

  const items: T[] = [];
  const errors: BrokerQueryError[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
      return;
    }
    const label = connections[i]!.label;
    logError(`Querying broker "${label}" failed`, result.reason);
    errors.push({
      brokerLabel: label,
      message: result.reason instanceof SempError ? result.reason.message : "Unexpected error",
    });
  });

  return { items, errors };
}
