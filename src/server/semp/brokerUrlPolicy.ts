import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

/**
 * Policy for which broker URLs the server may be told to call.
 *
 * POST /api/connection makes the server fetch a user-supplied URL, which is
 * a server-side request forgery (SSRF) surface - especially in "workshop
 * mode" without login. Three layers:
 *
 * 1. Always blocked: link-local / cloud-metadata addresses (169.254.0.0/16,
 *    fe80::/10, the AWS IPv6 metadata address, metadata hostnames), in every
 *    spelling - including IPv4-mapped IPv6 such as [::ffff:169.254.169.254],
 *    which the URL parser rewrites to [::ffff:a9fe:a9fe]. No legitimate
 *    Solace broker lives there, and they expose instance credentials on
 *    every major cloud. IP parsing is done by ipaddr.js (also what Express's
 *    own proxy-addr uses), not by hand-written regexes.
 * 2. The same check on every address the hostname resolves to
 *    (checkResolvedBrokerHost), so a DNS name pointing at a metadata
 *    address is refused too.
 * 3. Optional allowlist (ALLOWED_BROKER_HOSTS): when set, ONLY these hosts
 *    (host or host:port) may be connected to.
 *
 * Known limitation: layer 2 checks the DNS answer at connect time, but the
 * SEMP client resolves the name again for every request, so a hostname that
 * changes its answer afterwards (DNS rebinding) is not caught. For hostile
 * networks use the allowlist and/or network-level egress rules.
 */

const BLOCKED_HOSTNAMES = new Set(["metadata.google.internal", "metadata.goog"]);

/** AWS's IPv6 instance-metadata address - inside fd00::/8 (unique local), so not covered by "linkLocal". */
const AWS_IPV6_METADATA = ipaddr.parse("fd00:ec2::254").toNormalizedString();

const BLOCKED_REASON = "baseUrl points to a link-local or cloud-metadata address, which is not allowed";
const BLOCKED_RESOLVED_REASON =
  "baseUrl host resolves to a link-local or cloud-metadata address, which is not allowed";

/** URL.hostname keeps IPv6 literals in brackets - ipaddr.js wants them bare. */
const withoutBrackets = (hostname: string): string => hostname.replace(/^\[|\]$/g, "");

/**
 * Whether `address` (an IP literal, IPv4 or IPv6, no brackets) is one the
 * server must never call. IPv4-mapped IPv6 is judged as the IPv4 address it
 * carries, because that is what the operating system connects to.
 */
export function isBlockedAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  const ip = ipaddr.process(address);
  if (ip.range() === "linkLocal") return true;
  return ip.kind() === "ipv6" && ip.toNormalizedString() === AWS_IPV6_METADATA;
}

/**
 * Returns a human-readable reason the URL is not allowed, or null if it is.
 * `allowedHosts` entries are "host" or "host:port", compared case-insensitively
 * against URL.host (which includes a non-default port).
 */
export function checkBrokerUrl(url: URL, allowedHosts: readonly string[] = []): string | null {
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || isBlockedAddress(withoutBrackets(hostname))) {
    return BLOCKED_REASON;
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

/** Every address a hostname resolves to - injectable so tests never hit real DNS. */
export type ResolveAll = (hostname: string) => Promise<readonly { address: string }[]>;

const resolveAll: ResolveAll = (hostname) => lookup(hostname, { all: true });

/**
 * Layer 2 (see the file comment): refuses a hostname if ANY address it
 * resolves to is blocked. Returns the reason, or null if it is fine.
 *
 * IP literals are skipped (checkBrokerUrl already judged them). A failed
 * lookup is not a policy violation: it returns null and leaves the error to
 * the connection test right after, which reports the real reason (e.g.
 * ENOTFOUND) to the Connect screen.
 */
export async function checkResolvedBrokerHost(
  hostname: string,
  resolve: ResolveAll = resolveAll,
): Promise<string | null> {
  if (ipaddr.isValid(withoutBrackets(hostname))) return null;

  let addresses: readonly { address: string }[];
  try {
    addresses = await resolve(hostname);
  } catch {
    return null;
  }
  return addresses.some(({ address }) => isBlockedAddress(address)) ? BLOCKED_RESOLVED_REASON : null;
}
