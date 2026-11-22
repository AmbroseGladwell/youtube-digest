import { ModelId, type GenerationKey, type Provider } from "@overview/domain";
import type { GenerationAttempt } from "../api/makeOverviewOnKeys.js";

export interface MadeWithProps {
  key: GenerationKey | undefined;
  provider: Provider | undefined;
  model: ModelId | undefined;
}

// A model not shaped like a provider's id is left out, so the event still parses.
export const madeWithProps = (attempt: GenerationAttempt | null): MadeWithProps => {
  return {
    key: attempt?.key,
    provider: attempt?.provider,
    model: ModelId.safeParse(attempt?.model).data,
  };
};
