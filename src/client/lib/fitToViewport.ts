/** Below this the panel stops shrinking; the page scrolls instead. */
const MIN_HEIGHT_PX = 240;

/**
 * How tall the sticky detail panel may be so it fits the window from where
 * it currently starts: below the header before scrolling, at its sticky
 * offset (`gap`) once pinned. Keeps its buttons in view in both cases.
 */
export function viewportFitHeight(viewportHeight: number, panelTop: number, gap: number): number {
  const top = Math.max(panelTop, gap);
  return Math.max(MIN_HEIGHT_PX, Math.round(viewportHeight - top - gap));
}
