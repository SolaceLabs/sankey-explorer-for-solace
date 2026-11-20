import type { BrokerConnectionStatus } from "../types";
import type { BrokerConfigEntry } from "./brokerConfig";

/** Connection id -> the credentials it was added with (browser tab memory only). */
export type BrokerConfigs = ReadonlyMap<string, BrokerConfigEntry>;

type Connect = (entry: BrokerConfigEntry) => Promise<BrokerConnectionStatus[]>;

/** Id of the one connection in `updated` that was not in `previous` yet. */
export const newConnectionId = (
  previous: readonly BrokerConnectionStatus[],
  updated: readonly BrokerConnectionStatus[],
): string | undefined => {
  const previousIds = new Set(previous.map((b) => b.id));
  return updated.find((b) => !previousIds.has(b.id))?.id;
};

/** Remember the credentials of the connection that `connect` just added. */
export const withNewConnectionConfig = (
  configs: BrokerConfigs,
  previous: readonly BrokerConnectionStatus[],
  updated: readonly BrokerConnectionStatus[],
  entry: BrokerConfigEntry,
): BrokerConfigs => {
  const id = newConnectionId(previous, updated);
  return id ? new Map(configs).set(id, entry) : configs;
};

export interface ConnectEachResult {
  brokers: BrokerConnectionStatus[];
  configs: BrokerConfigs;
  /** One "label: reason" per entry that could not connect. */
  failures: string[];
}

/**
 * Connect the entries one after another (the server returns the full list
 * each time), keep going past failures and report them per entry, so one
 * bad entry in an imported file does not lose the good ones.
 */
export async function connectEach(
  entries: readonly BrokerConfigEntry[],
  start: { brokers: BrokerConnectionStatus[]; configs: BrokerConfigs },
  connect: Connect,
  describeError: (err: unknown) => string,
): Promise<ConnectEachResult> {
  let { brokers, configs } = start;
  const failures: string[] = [];
  for (const entry of entries) {
    try {
      const updated = await connect(entry);
      configs = withNewConnectionConfig(configs, brokers, updated, entry);
      brokers = updated;
    } catch (err) {
      failures.push(`${entry.label || entry.vpn}: ${describeError(err)}`);
    }
  }
  return { brokers, configs, failures };
}
