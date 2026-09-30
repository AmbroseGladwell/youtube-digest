export interface OAuthUrls {
  issuer: string;
  authorize: string;
  token: string;
  register: string;
  revoke: string;
  resource: string;
  resourceMetadata: string;
  consent: (authorizationId: string) => string;
}

export function oauthUrls(appUrl: string): OAuthUrls {
  const issuer = appUrl.replace(/\/+$/, "");
  return {
    issuer,
    authorize: `${issuer}/oauth/authorize`,
    token: `${issuer}/oauth/token`,
    register: `${issuer}/oauth/register`,
    revoke: `${issuer}/oauth/revoke`,
    resource: `${issuer}/mcp`,
    resourceMetadata: `${issuer}/.well-known/oauth-protected-resource/mcp`,
    consent: (authorizationId) => `${issuer}/connect/${authorizationId}`,
  };
}
