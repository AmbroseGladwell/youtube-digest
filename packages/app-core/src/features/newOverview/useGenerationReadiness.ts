import { DEFAULT_PROVIDER, type Provider } from "@overview/domain";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { hasKeyFor, providersWithKeys } from "../apiKeys/ApiKeys.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useServiceTranscriptStatusQuery } from "../transcripts/queries/serviceTranscriptStatusQuery.js";

// Richer than the yes/no it used to be, because the design asks three different questions
// of it. A transcript no longer has one source, so "have you pasted both keys" was already
// the wrong question: a shell that can reach YouTube needs nothing more
// (docs/features/transcript-retrieval.md), nor does a reader whose server fetches them
// itself (docs/architecture/server-side-transcripts.md). And a key is now per provider, so
// "do you have a key" and "do you have the key you chose" are two questions with different
// answers and different ways out (design 110g).
export interface GenerationReadiness {
  ready: boolean;
  // The provider this account generates with, which follows the reader between devices.
  provider: Provider;
  // Whether this device holds that provider's key. False with other keys present is the
  // state design 110g draws: chosen elsewhere, unusable here.
  hasChosenKey: boolean;
  // A provider this device could generate with instead, so the dead end has a way out
  // that does not need a password manager. Null when there is no key here at all.
  fallback: Provider | null;
  needsTranscriptSource: boolean;
}

export function useGenerationReadiness(): GenerationReadiness {
  const { apiKeys } = useApiKeys();
  const settings = useSettingsQuery().data;
  const youTubeFetch = useYouTubeFetch();
  const serviceStatus = useServiceTranscriptStatusQuery();

  const provider = settings?.provider ?? DEFAULT_PROVIDER;
  const hasChosenKey = hasKeyFor(apiKeys, provider);
  const needsTranscriptSource = youTubeFetch === null && serviceStatus.data?.available !== true;
  const fallback = providersWithKeys(apiKeys).find((held) => held !== provider) ?? null;

  return {
    ready: hasChosenKey && !needsTranscriptSource,
    provider,
    hasChosenKey,
    fallback,
    needsTranscriptSource,
  };
}
