/**
 * Extracts a display-friendly host (with port, if non-default) from a
 * connection's baseUrl, e.g. "http://localhost:8080" -> "localhost:8080".
 * Used for the "vpn at host" sub-label shown per endpoint when multiple
 * message VPNs are connected. Falls back to the raw baseUrl on parse
 * failure - shouldn't happen since it was already validated as a URL at
 * connect time, but this is display code, not worth throwing over.
 */
export function parseHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
