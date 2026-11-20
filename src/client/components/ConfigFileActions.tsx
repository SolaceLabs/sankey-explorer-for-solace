import { useRef, type ChangeEvent } from "react";

interface ConfigFileActionsProps {
  /** Connections whose credentials this tab knows, so they can be exported. */
  exportableCount: number;
  connectionCount: number;
  importing: boolean;
  onExport: () => void;
  onImport: (file: File) => void;
}

/** Export / import of all connections as one YAML file, with what that means. */
export function ConfigFileActions({
  exportableCount,
  connectionCount,
  importing,
  onExport,
  onImport,
}: ConfigFileActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file later
    if (file) onImport(file);
  }

  return (
    <>
      <div className="config-file-actions">
        <button type="button" onClick={onExport} disabled={exportableCount === 0}>
          Export config
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? "Importing..." : "Import config"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml,application/x-yaml,text/yaml"
          onChange={handleFile}
          hidden
        />
      </div>
      <p className="hint">
        Export saves every connection added in this browser tab
        {exportableCount > 0 ? ` (${exportableCount} of ${connectionCount})` : ""} as one YAML
        file, including passwords in clear text - it never leaves your
        machine, but store it as carefully as the passwords themselves.
        {connectionCount > 0 && exportableCount < connectionCount && (
          <> Connections from before a page reload aren't included - remove and re-add them to export them too.</>
        )}
      </p>
    </>
  );
}
