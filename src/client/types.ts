// EndpointType/EndpointInfo used to be declared here too, by hand, kept in
// sync manually with the server's copy - now a single real definition in
// src/shared, imported by both sides.
export type {
  BrokerQueryError,
  EndpointType,
  EndpointInfo,
  EndpointsResponse,
} from "../shared/types.js";

export interface BrokerConnectionStatus {
  id: string;
  label: string;
  vpn: string;
  baseUrl: string;
  connectedAt: number;
}

export interface SessionInfo {
  authRequired: boolean;
  authenticated: boolean;
  /** A session can have multiple broker connections at once (e.g. a mesh of brokers). */
  brokers: BrokerConnectionStatus[];
}

export interface ApiError {
  error: string;
}
