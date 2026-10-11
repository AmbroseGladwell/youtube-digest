import { DEFAULT_MODEL, Provider } from "@overview/domain";
import { createGenerationClient, type GenerationClient } from "@overview/generation";

// These scripts ran on `new Anthropic()`, which read ANTHROPIC_API_KEY out of the
// environment by itself. There is no SDK any more (docs/features/byo-providers.md), so the
// same convention is spelled out here, with the other five reachable by naming one.
export function generationClientFromEnv(): GenerationClient {
  const named = process.env.OVERVIEW_PROVIDER;
  const provider = named === undefined ? "anthropic" : Provider.parse(named);
  const apiKey = process.env.OVERVIEW_API_KEY ?? process.env.ANTHROPIC_API_KEY;

  if (apiKey === undefined) {
    throw new Error(
      "no API key in the environment: set ANTHROPIC_API_KEY, or OVERVIEW_PROVIDER and OVERVIEW_API_KEY together",
    );
  }

  return createGenerationClient({
    provider,
    apiKey,
    model: process.env.OVERVIEW_MODEL ?? DEFAULT_MODEL[provider],
  });
}
