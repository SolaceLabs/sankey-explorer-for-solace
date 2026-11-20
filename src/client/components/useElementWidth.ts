import { useEffect, useState, type RefObject } from "react";

/** The element's content width, kept current by a ResizeObserver. */
export function useElementWidth(ref: RefObject<HTMLElement | null>, initialWidth: number): number {
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
