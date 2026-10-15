import type { SempClientOptions } from "../../shared/types.js";

/**
 * SEMP v2 (RESTful JSON) - https://docs.solace.com/SEMP/SEMP-Home.htm
 * Monitor API base path: {baseUrl}/SEMP/v2/monitor
 *
 * Much simpler than SEMP v1 (Legacy SEMP, XML/RPC) was: plain HTTP GET +
 * Basic Auth + JSON, no XML parsing, no custom "more-cookie" pagination -
 * SEMP v2 collection replies carry their own absolute "next page" URL in
 * `meta.paging.nextPageUri`, so following it is just "fetch that URL next".
 */

/** Per-request ceiling; SEMP monitor calls are small, a healthy broker answers in well under this. */
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export class SempError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "SempError";
  }
}

/** Shape of every SEMP v2 collection (list) reply - only the fields this app uses. */
export interface SempV2Page<T> {
  data: T[];
  meta?: {
    paging?: {
      /** Absolute URL for the next page, present only while there is one. */
      nextPageUri?: string;
    };
  };
}

export class SempV2Client {
  /**
   * Earliest time (ms since epoch) at which the NEXT request may be sent.
   * Slots are reserved synchronously in throttle() - before any await - so
   * concurrent callers (queries.ts fans out with Promise.all) each get their
   * own, strictly later slot instead of all computing the same wait.
   */
  private nextSlotAt = 0;

  constructor(private readonly options: SempClientOptions) {}

  private authHeader(): string {
    const { username, password } = this.options;
    const credentials = `${username}:${password}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  /**
   * The broker's SEMP v2 Monitor API root, with any trailing slash(es)
   * trimmed. Deliberately a plain loop rather than a `/\/+$/` regex - a
   * repeated-character-class-anchored-at-end pattern like that is exactly
   * the shape static analyzers flag as super-linear/backtracking-prone on
   * general principle (even though this particular one is safe), and a
   * user-supplied broker URL is untrusted input - simplest to just not
   * have a regex here at all.
   */
  private monitorBase(): string {
    let base = this.options.baseUrl;
    while (base.endsWith("/")) {
      base = base.slice(0, -1);
    }
    return `${base}/SEMP/v2/monitor`;
  }

  private async getJson<T>(url: string): Promise<T> {
    await this.throttle();

    const timeoutMs = this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: this.authHeader() },
        // A hung or black-holed broker must fail the request, not hang it.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new SempError(`SEMP request timed out after ${timeoutMs}ms: ${url}`, err);
      }
      throw new SempError(`SEMP request failed (network): ${url}`, err);
    }

    if (!response.ok) {
      throw new SempError(
        `SEMP request failed: HTTP ${response.status} ${response.statusText} (${url})`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      throw new SempError(`Malformed SEMP reply (not valid JSON): ${url}`, err);
    }
  }

  /**
   * Fetches every page of a SEMP v2 collection endpoint (following
   * `meta.paging.nextPageUri` until it's no longer present) and returns the
   * combined `data` from every page.
   *
   * Recursive rather than a `while` loop with an `await` in its body - not
   * just style: pagination is genuinely sequential (the next page's URL
   * isn't known until the current page's response arrives, so there's
   * nothing to parallelize here), but a loop-shaped `await` can't express
   * that it's intentional vs. accidentally-sequential code that should
   * have used `Promise.all`. Async recursion doesn't grow the call stack
   * across an `await` the way synchronous recursion would (each
   * continuation resumes as its own microtask), so this is just as safe
   * for a broker with many pages as the loop version was.
   */
  private async getCollection<T>(url: string): Promise<T[]> {
    const page = await this.getJson<SempV2Page<T>>(url);
    const nextUrl = page.meta?.paging?.nextPageUri;
    if (!nextUrl) return page.data;
    this.assertSameOrigin(nextUrl);
    return [...page.data, ...(await this.getCollection<T>(nextUrl))];
  }

  /**
   * Fetches a full (all pages) collection under a given message VPN, e.g.
   * `getVpnCollection(vpn, "/queues")` or
   * `getVpnCollection(vpn, "/queues/my-queue/subscriptions")`. `path` must
   * already have its own segments URL-encoded (object names can contain
   * characters that need escaping - see encodeURIComponent calls in
   * queries.ts).
   */
  async getVpnCollection<T>(vpn: string, path: string): Promise<T[]> {
    const url = `${this.monitorBase()}/msgVpns/${encodeURIComponent(vpn)}${path}?count=100`;
    return this.getCollection<T>(url);
  }

  /**
   * The broker's reply is untrusted input: a (compromised or malicious)
   * broker could point `nextPageUri` at any host and receive our Basic Auth
   * header there (credential leak) or make us probe internal addresses
   * (SSRF). Only follow pagination links that stay on the origin the user
   * connected to.
   */
  private assertSameOrigin(candidateUrl: string): void {
    let candidateOrigin: string;
    try {
      candidateOrigin = new URL(candidateUrl).origin;
    } catch {
      throw new SempError(`Refusing malformed pagination URL from broker: ${candidateUrl}`);
    }
    if (candidateOrigin !== new URL(this.options.baseUrl).origin) {
      throw new SempError(
        `Refusing to follow pagination link to a different origin (${candidateOrigin})`,
      );
    }
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = slot + this.options.minRequestIntervalMs;
    const wait = slot - now;
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  /**
   * Lightweight connection test for the Connect screen: fails with
   * SempError on wrong credentials/URL/network error, otherwise no error.
   * Plain `GET {baseUrl}/SEMP/v2/monitor` is deliberately chosen - it
   * returns broker-wide info (including the SolOS version, under
   * `data.version`) without needing any message-VPN-level permissions, the
   * same role SEMP v1's "show version" played here before.
   */
  async ping(): Promise<void> {
    await this.getJson(this.monitorBase());
  }
}
