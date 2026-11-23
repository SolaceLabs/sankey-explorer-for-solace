import { toSankeyEdges, type SankeyEdge } from "../../shared/toSankeyEdges";
import type { ConsumerLookup, EndpointInfo } from "../types";
import { buildEndpointBrokerColors, type EndpointBrokerColors } from "./buildEndpointBrokerColors";
import { buildEndpointBrokerLabels } from "./buildEndpointBrokerLabels";
import { buildEndpointOwners } from "./buildEndpointOwners";
import { buildEndpointVpnHost } from "./buildEndpointVpnHost";
import { buildEndpointLabelMap } from "./buildEndpointLabelMap";

/** Everything the diagram needs, derived once from one endpoints reply. */
export interface DiagramData {
  edges: SankeyEdge[];
  endpointOwners: Map<string, string>;
  endpointBrokerColors: EndpointBrokerColors;
  endpointBrokerLabels: Map<string, string>;
  endpointVpnHost: Map<string, string>;
  /** Names of endpoints without any subscription. */
  unsubscribedEndpoints: string[];
  /** Node id -> broker/type/name of each queue and topic endpoint, for on-demand consumer lookups. */
  consumerLookups: Map<string, ConsumerLookup>;
}

const consumerLookupOf = (e: EndpointInfo): ConsumerLookup | undefined =>
  e.type === "direct-subscriber" ? undefined : { brokerLabel: e.brokerLabel, type: e.type, name: e.name };

/**
 * Derive the diagram's inputs from the endpoints. Callers memoize the
 * result per reply: the chart keys its selection and layout on these
 * references, so rebuilding them on every render would drop the selection.
 */
export const buildDiagramData = (endpoints: EndpointInfo[]): DiagramData => ({
  edges: toSankeyEdges(endpoints),
  endpointOwners: buildEndpointOwners(endpoints),
  endpointBrokerColors: buildEndpointBrokerColors(endpoints),
  endpointBrokerLabels: buildEndpointBrokerLabels(endpoints),
  endpointVpnHost: buildEndpointVpnHost(endpoints),
  unsubscribedEndpoints: endpoints.filter((e) => e.subscriptions.length === 0).map((e) => e.name),
  consumerLookups: buildEndpointLabelMap(endpoints, consumerLookupOf),
});
