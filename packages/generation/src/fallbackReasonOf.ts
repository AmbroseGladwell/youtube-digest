import { ProviderOutOfCreditError, ProviderRequestError, SchemaFailureError } from "./GenerationError.js";

export type FallbackReason = "out-of-credit" | "provider-down" | "schema-failure";

// Which failures move to the next key: docs/architecture/tiers.md, "Which key an overview uses".
export const fallbackReasonOf = (error: unknown): FallbackReason | null => {
  if (error instanceof ProviderOutOfCreditError) {
    return "out-of-credit";
  }
  if (error instanceof ProviderRequestError && (error.status === 429 || error.status >= 500)) {
    return "provider-down";
  }
  if (error instanceof SchemaFailureError) {
    return "schema-failure";
  }
  return null;
};
