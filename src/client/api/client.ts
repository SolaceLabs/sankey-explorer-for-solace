import type {
  ApiError,
  BrokerConnectionStatus,
  ConsumerLookup,
  ConsumersResponse,
  EndpointsResponse,
  MetricsResponse,
  SessionInfo,
} from "../types";

export class ApiRequestError extends Error {}

/**
 * What to show the user for a failed call: the server's own message for an
 * API error, otherwise the caller's fallback (network failure, bug), since
 * a raw TypeError says nothing useful.
 */
export const apiErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiRequestError ? err.message : fallback;

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as ApiError | null)?.error ?? response.statusText;
    throw new ApiRequestError(message);
  }

  return body as T;
}

export const api = {
  getSession: () => request<SessionInfo>("/session"),

  login: (username: string, password: string) =>
    request<{ authenticated: boolean }>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ authenticated: boolean }>("/logout", { method: "POST" }),

  /** Adds a new broker connection - does NOT replace existing ones. Returns the full updated list. */
  connect: (input: {
    baseUrl: string;
    vpn: string;
    username: string;
    password: string;
    label?: string;
  }) =>
    request<BrokerConnectionStatus[]>("/connection", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** Removes ONE broker connection, keeping the others. Returns the full updated list. */
  disconnectOne: (id: string) =>
    request<BrokerConnectionStatus[]>(`/connection/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  /** Removes ALL broker connections in this session. */
  disconnectAll: () =>
    request<BrokerConnectionStatus[]>("/connection", { method: "DELETE" }),

  getEndpoints: () => request<EndpointsResponse>("/endpoints"),

  /** One live telemetry sample. `signal` lets the poller abort a request it no longer needs. */
  getMetrics: (signal?: AbortSignal) => request<MetricsResponse>("/metrics", { signal }),

  /** Consumer flows bound to one queue or topic endpoint (on demand, not polled). */
  getConsumers: (endpoint: ConsumerLookup, signal?: AbortSignal) => {
    const query = new URLSearchParams({ broker: endpoint.brokerLabel, type: endpoint.type, name: endpoint.name });
    return request<ConsumersResponse>(`/metrics/consumers?${query.toString()}`, { signal });
  },
};

