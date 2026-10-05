export const API_ERROR_CODES = {
  invalid_request: 400,
  unauthenticated: 401,
  client_unsupported: 403,
  plan_required: 403,
  not_found: 404,
  already_exists: 409,
  link_invalid: 410,
  record_newer_than_client: 409,
  revision_mismatch: 412,
  transcript_unavailable: 422,
  too_many_requests: 429,
  internal_error: 500,
  unavailable: 503,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;
