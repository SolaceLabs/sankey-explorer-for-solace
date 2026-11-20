interface ExportSvgButtonProps {
  onExport: () => void;
}

/** Round, icon-only "Export SVG" button - lives in the app's top bar. */
export function ExportSvgButton({ onExport }: ExportSvgButtonProps) {
  return (
    <button
      type="button"
      className="icon-button icon-button--outline"
      aria-label="Export SVG"
      title="Export SVG"
      onClick={onExport}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="icon">
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </svg>
    </button>
  );
}
