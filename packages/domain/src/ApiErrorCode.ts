export const API_ERROR_CODES = {
  invalid_request: 400,
  unauthenticated: 401,
  client_unsupported: 403,
  not_found: 404,
  already_exists: 409,
  record_newer_than_client: 409,
  revision_mismatch: 412,
  internal_error: 500,
  unavailable: 503,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;
