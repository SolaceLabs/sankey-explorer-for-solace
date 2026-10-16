/**
 * Minimal server-side logging - one JSON object per line (stdout for info,
 * stderr for errors), no library. This is a single-process-per-customer/
 * workshop tool (see README "Deployment model"), so there's no central log
 * aggregation to ship to yet; the goal is to make `docker logs <container>`
 * (or the terminal under `npm run dev`) useful - and machine-parseable - when
 * a broker connection fails, which is otherwise invisible (the HTTP response
 * to the Connect screen deliberately carries only a short reason).
 *
 * JSON output also closes log injection (CWE-117): user-controlled values
 * (broker URL, label, username) end up inside a JSON string where CR/LF and
 * quotes are escaped, so input can't forge extra log lines.
 *
 * NEVER pass a password (or anything else secret) into these - there's no
 * redaction here, by design: callers are expected to only log the
 * non-secret fields (baseUrl, vpn, username, label) plus the error.
 */

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return typeof err === "string" ? err : String(err);
}

export function logInfo(message: string): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", message }));
}

export function logError(message: string, err?: unknown): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      ...(err !== undefined ? { error: serializeError(err) } : {}),
    }),
  );
}
