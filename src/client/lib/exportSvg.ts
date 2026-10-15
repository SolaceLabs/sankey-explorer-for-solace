const SVG_NS = "http://www.w3.org/2000/svg";
const EXPORT_BACKGROUND = "#093B5F"; // --panel, Deep Blue

/**
 * Downloads the given live diagram as a standalone SVG file.
 *
 * The live SVG renders transparent, relying on the app's dark page
 * background - that is added back explicitly so the exported file looks
 * right when opened on its own (browser tab, image viewer).
 */
export function downloadSvg(
  svgEl: SVGSVGElement,
  width: number,
  height: number,
  fileName = "sankey-diagram.svg",
): void {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", SVG_NS);

  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", EXPORT_BACKGROUND);
  clone.insertBefore(background, clone.firstChild);

  const source =
    '<?xml version="1.0" standalone="no"?>\n' + new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
