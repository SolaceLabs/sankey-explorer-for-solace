import { endpointDisplayName } from "./endpointDisplayName";
import { isEndpointNode } from "./nodeKind";

/** Searchable text of a node: the full topic path, or an endpoint's bare name. */
export const searchText = (id: string): string =>
  (isEndpointNode(id) ? endpointDisplayName(id) : id).toLowerCase();

/**
 * "retail/orders/*" means "the retail/orders level" to a person typing a
 * search, even though no node has that literal id (only a real "*"
 * subscription would). Strips one trailing wildcard level or slash.
 */
const stripTrailingWildcard = (query: string): string => query.replace(/\/(\*|>)?$/, "");

/** Sort order for partial matches: prefix matches first, then shorter ids. */
export const byPreference = (query: string) => (a: string, b: string): number => {
  const aStarts = searchText(a).startsWith(query) ? 0 : 1;
  const bStarts = searchText(b).startsWith(query) ? 0 : 1;
  if (aStarts !== bStarts) return aStarts - bStarts;
  if (a.length !== b.length) return a.length - b.length;
  return a.localeCompare(b);
};

/**
 * Resolves what someone typed into the diagram search to one node id, or
 * null if nothing fits. Tried in order, first hit wins:
 *
 * 1. the exact node id (case-sensitive, so a literal wildcard subscription
 *    like "retail/orders/>" can still be found as itself),
 * 2. a full topic path or bare endpoint name, case-insensitive,
 * 3. the same with a trailing "/*" or "/>" removed,
 * 4. a partial match - prefix matches first, then the shortest id.
 */
export function findNodeByQuery(nodeIds: readonly string[], rawQuery: string): string | null {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;
  if (nodeIds.includes(trimmed)) return trimmed;

  const query = trimmed.toLowerCase();
  const exact = nodeIds.find((id) => searchText(id) === query);
  if (exact) return exact;

  const level = stripTrailingWildcard(query);
  const levelMatch = level !== query ? nodeIds.find((id) => searchText(id) === level) : undefined;
  if (levelMatch) return levelMatch;

  const partial = nodeIds.filter((id) => searchText(id).includes(query));
  return partial.sort(byPreference(query))[0] ?? null;
}
