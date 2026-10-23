import { ProviderOutOfCreditError, ProviderRequestError, SchemaFailureError } from "./GenerationError.js";

export type FallbackReason = "out-of-credit" | "provider-down" | "schema-failure";

// Why a failed generation may move to the next key, or null when it must not. A refused key
// never moves: the reader sees the key problem and fixes it, rather than a broken key going
// unnoticed while it spends ours (docs/architecture/tiers.md, "Which key an overview uses").
// A spent quota is the server's to say, not the provider's, so it isn't decided here.
export function fallbackReasonOf(error: unknown): FallbackReason | null {
  if (error instanceof ProviderOutOfCreditError) return "out-of-credit";
  if (error instanceof ProviderRequestError && (error.status === 429 || error.status >= 500)) return "provider-down";
  if (error instanceof SchemaFailureError) return "schema-failure";
  return null;
}
