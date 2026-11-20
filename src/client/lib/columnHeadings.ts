import { isEndpointNode } from "./nodeKind";

export interface ColumnHeading {
  /** Left edge of the column, in diagram (SVG) coordinates. */
  x: number;
  label: string;
}

interface PositionedNode {
  id: string;
  x0?: number | undefined;
}

/**
 * One heading per diagram column, read off the laid-out nodes: topic
 * columns become "Level 1", "Level 2", ... left to right, the endpoint
 * column "Endpoints". Derived from positions rather than node depth, so it
 * always matches where d3-sankey actually drew the columns.
 */
export function columnHeadings(nodes: readonly PositionedNode[]): ColumnHeading[] {
  const topicColumns = new Set<number>();
  let endpointColumn: number | null = null;

  for (const node of nodes) {
    if (node.x0 === undefined) continue;
    if (isEndpointNode(node.id)) endpointColumn = Math.min(endpointColumn ?? node.x0, node.x0);
    else topicColumns.add(node.x0);
  }

  const headings = [...topicColumns]
    .sort((a, b) => a - b)
    .map((x, i) => ({ x, label: `Level ${i + 1}` }));
  if (endpointColumn !== null) headings.push({ x: endpointColumn, label: "Endpoints" });
  return headings;
}
