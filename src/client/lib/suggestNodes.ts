import { byPreference, searchText } from "./findNodeByQuery";
import { endpointDisplayName } from "./endpointDisplayName";
import { isEndpointNode } from "./nodeKind";

export interface NodeSuggestion {
  id: string;
  /** What the list shows: the full topic path, or the endpoint's bare name. */
  label: string;
  isEndpoint: boolean;
}

const DEFAULT_LIMIT = 8;

/**
 * Suggestions for the diagram search while typing: every topic path or
 * endpoint name containing the query, in the same order findNodeByQuery
 * prefers (so the first suggestion is what Enter would pick for a partial
 * query). Empty for an empty query.
 */
export function suggestNodes(
  nodeIds: readonly string[],
  rawQuery: string,
  limit = DEFAULT_LIMIT,
): NodeSuggestion[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  return nodeIds
    .filter((id) => searchText(id).includes(query))
    .sort(byPreference(query))
    .slice(0, limit)
    .map((id) => {
      const isEndpoint = isEndpointNode(id);
      return { id, label: isEndpoint ? endpointDisplayName(id) : id, isEndpoint };
    });
}
