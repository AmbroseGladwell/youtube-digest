import type { Provider } from "@overview/domain";
import { ModelRefusedError, SchemaFailureError } from "@overview/generation";

// The reader's own key reached its provider, and the model they chose couldn't make the
// overview, which they can change in Settings. The provider's own words stay on `cause`,
// for logs, and never reach the screen (OV-247).
export class ChosenModelFailedError extends Error {
  readonly provider: Provider;
  readonly model: string;
  readonly reason: "refused" | "schema";
  readonly status: number | null;

  constructor(provider: Provider, model: string, cause: ModelRefusedError | SchemaFailureError) {
    super(`${provider} couldn't make this overview with ${model}`, { cause });
    this.provider = provider;
    this.model = model;
    this.reason = cause instanceof ModelRefusedError ? "refused" : "schema";
    this.status = cause instanceof ModelRefusedError ? cause.status : null;
  }
}

export const failedOnTheModel = (error: unknown): error is ModelRefusedError | SchemaFailureError =>
  error instanceof ModelRefusedError || error instanceof SchemaFailureError;
