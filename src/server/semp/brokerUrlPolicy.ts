/**
 * Policy for which broker URLs the server may be told to call.
 *
 * POST /api/connection makes the server fetch a user-supplied URL, which is
 * a server-side request forgery (SSRF) surface - especially in "workshop
 * mode" without login. Two layers:
 *
 * 1. Always blocked: link-local / cloud-metadata addresses (169.254.0.0/16,
 *    fe80::/10, metadata hostnames). No legitimate Solace broker lives there,
 *    and they expose instance credentials on every major cloud.
 * 2. Optional allowlist (ALLOWED_BROKER_HOSTS): when set, ONLY these hosts
 *    (host or host:port) may be connected to.
 *
 * Known limitation: this checks the literal hostname, not the DNS result, so
 * a hostname that resolves to a blocked address (DNS rebinding) is not caught.
 * For hostile networks use the allowlist and/or network-level egress rules.
 */

const BLOCKED_HOSTNAMES = new Set(["metadata.google.internal", "metadata.goog"]);

function isLinkLocalIPv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
  return m !== null && m[1] === "169" && m[2] === "254";
}

function isLinkLocalIPv6(hostname: string): boolean {
  // URL.hostname keeps IPv6 literals in brackets, lowercased.
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (!bare.includes(":")) return false;
  // fe80::/10 (fe80-febf) and the AWS IPv6 metadata address fd00:ec2::254.
  return /^fe[89ab][0-9a-f]:/.test(bare) || bare === "fd00:ec2::254";
}

/**
 * Returns a human-readable reason the URL is not allowed, or null if it is.
 * `allowedHosts` entries are "host" or "host:port", compared case-insensitively
 * against URL.host (which includes a non-default port).
 */
export function checkBrokerUrl(url: URL, allowedHosts: readonly string[] = []): string | null {
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || isLinkLocalIPv4(hostname) || isLinkLocalIPv6(hostname)) {
    return "baseUrl points to a link-local or cloud-metadata address, which is not allowed";
  }

  if (allowedHosts.length > 0) {
    const host = url.host.toLowerCase();
    const permitted = allowedHosts.some((entry) => {
      const e = entry.toLowerCase();
      return e === host || e === hostname;
    });
    if (!permitted) {
      return "baseUrl host is not in this instance's ALLOWED_BROKER_HOSTS list";
    }
  }

  return null;
}
