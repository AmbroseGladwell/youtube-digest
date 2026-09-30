export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "invalid_target"
  | "invalid_redirect_uri"
  | "invalid_client_metadata"
  | "server_error";

// The protocol's own error shape, not the /api envelope: these routes are called by
// assistants that speak OAuth, not by our clients (docs/features/mcp-connector.md).
export class OAuthError extends Error {
  readonly code: OAuthErrorCode;
  readonly status: number;

  constructor(code: OAuthErrorCode, description: string, status = code === "invalid_client" ? 401 : 400) {
    super(description);
    this.code = code;
    this.status = status;
  }
}

export const isOAuthError = (error: unknown): error is OAuthError => error instanceof OAuthError;
