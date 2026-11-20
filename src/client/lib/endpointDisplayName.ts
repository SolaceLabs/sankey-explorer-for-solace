import { stripEndpointTypePrefix } from "../../shared/endpointNodeId";
import { isEndpointNode } from "./nodeKind";

/**
 * Strips the type prefix ("Queue: "/"Topic Endpoint: ") and any trailing
 * broker-disambiguation suffix ("(EU-Broker)") from an endpoint node id,
 * leaving just the bare name for display. The full id is still what's
 * used internally for graph identity, sorting, and filtering - this is
 * display-only, the same separation nodeDisplayLabel makes for topic
 * hierarchy nodes.
 */
export function endpointDisplayName(id: string): string {
  if (!isEndpointNode(id)) return id;
  return stripEndpointTypePrefix(id).replace(/ \([^)]*\)$/, "");
}
