import { useEffect, useState, type RefObject } from "react";
import { viewportFitHeight } from "../lib/fitToViewport";

/**
 * Max height for a sticky element so it always fits the window, updated on
 * scroll and resize (one measurement per frame). Undefined while the
 * element is not sticky (narrow screens stack it below the diagram), so the
 * stylesheet's own rules apply there.
 */
export function useViewportFitHeight(ref: RefObject<HTMLElement | null>, gap: number): number | undefined {
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el || getComputedStyle(el).position !== "sticky") {
        setMaxHeight(undefined);
        return;
      }
      setMaxHeight(viewportFitHeight(window.innerHeight, el.getBoundingClientRect().top, gap));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, gap]);

  return maxHeight;
}
