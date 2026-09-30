import type { TokenEndpointAuthMethod } from "./ClientRegistration.js";

export interface OAuthClient {
  id: string;
  clientName: string | null;
  redirectUris: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  clientSecretHash: string | null;
}
