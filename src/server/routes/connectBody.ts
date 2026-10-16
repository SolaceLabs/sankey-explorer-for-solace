/**
 * Validation of the POST /api/connection body. A pure function so the route
 * handler never touches `req.body` as an untyped value (parse, don't cast) and
 * every rule is unit-testable without HTTP.
 */

export interface ConnectInput {
  baseUrl: string;
  vpn: string;
  username: string;
  password: string;
  label?: string;
}

export type ParseResult = { ok: true; value: ConnectInput } | { ok: false; error: string };

const MAX_URL_LENGTH = 2048;
const MAX_FIELD_LENGTH = 255;

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validates an untrusted request body; never throws, whatever `body` is (incl. undefined). */
export function parseConnectBody(body: unknown): ParseResult {
  const requiredMessage = "baseUrl, vpn, username and password are required";
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: requiredMessage };
  }
  const { baseUrl, vpn, username, password, label } = body as Record<string, unknown>;

  if (
    !isNonBlankString(baseUrl) ||
    !isNonBlankString(vpn) ||
    !isNonBlankString(username) ||
    !isNonBlankString(password)
  ) {
    return { ok: false, error: requiredMessage };
  }
  if (label !== undefined && typeof label !== "string") {
    return { ok: false, error: "label must be a string" };
  }

  if (baseUrl.length > MAX_URL_LENGTH) {
    return { ok: false, error: `baseUrl is too long (max ${MAX_URL_LENGTH} characters)` };
  }
  const bounded: [string, string][] = [
    ["vpn", vpn],
    ["username", username],
    ["password", password],
    ["label", label ?? ""],
  ];
  for (const [name, value] of bounded) {
    if (value.length > MAX_FIELD_LENGTH) {
      return { ok: false, error: `${name} is too long (max ${MAX_FIELD_LENGTH} characters)` };
    }
  }

  return { ok: true, value: { baseUrl, vpn, username, password, label } };
}
