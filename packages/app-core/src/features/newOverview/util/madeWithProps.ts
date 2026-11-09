import { ModelId, type GenerationKey, type Provider } from "@overview/domain";
import type { GenerationAttempt } from "../api/makeOverviewOnKeys.js";

export interface MadeWithProps {
  key: GenerationKey | undefined;
  provider: Provider | undefined;
  model: ModelId | undefined;
}

// A model that isn't shaped like a provider's id is left out, not sent, so the event still
// parses (docs/architecture/analytics.md, "What an event may carry").
export function madeWithProps(attempt: GenerationAttempt | null): MadeWithProps {
  return {
    key: attempt?.key,
    provider: attempt?.provider,
    model: ModelId.safeParse(attempt?.model).data,
  };
}
