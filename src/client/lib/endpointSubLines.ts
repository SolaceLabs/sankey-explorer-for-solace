/** Lookups for the small lines under an endpoint's name in the diagram. */
export interface EndpointSubLineSources {
  owners?: ReadonlyMap<string, string> | undefined;
  /** Only passed while more than one message VPN is in play. */
  vpnHosts?: ReadonlyMap<string, string> | undefined;
}

/** The owner first, then "vpn @ host" - whichever of the two is known. */
export const endpointSubLines = (endpointId: string, { owners, vpnHosts }: EndpointSubLineSources): string[] =>
  [owners?.get(endpointId), vpnHosts?.get(endpointId)].filter((line): line is string => Boolean(line));
