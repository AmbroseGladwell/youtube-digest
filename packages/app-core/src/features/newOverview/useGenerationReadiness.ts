import { DEFAULT_PROVIDER, type Provider } from "@overview/domain";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { hasKeyFor, providersWithKeys } from "../apiKeys/ApiKeys.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useAccountNeeded } from "../accountLibraries/useAccountNeeded.js";
import { useServiceTranscriptStatusQuery } from "../transcripts/queries/serviceTranscriptStatusQuery.js";
import { useOurKeyStatusQuery } from "./queries/ourKeyStatusQuery.js";

// Why this asks several questions: docs/features/transcript-retrieval.md, "What generation now requires".
export interface GenerationReadiness {
  ready: boolean;
  provider: Provider;
  hasChosenKey: boolean;
  // Null when this device holds no key at all.
  fallback: Provider | null;
  // docs/architecture/tiers.md, "Which key an overview uses".
  ourKeyUsable: boolean;
  needsTranscriptSource: boolean;
  // docs/architecture/tiers.md, "Signed out".
  accountNeeded: boolean;
  // Until true, `ready` is false for want of knowing, so anything acting on a press must wait.
  settled: boolean;
}

export const useGenerationReadiness = (): GenerationReadiness => {
  const { apiKeys } = useApiKeys();
  const settingsQuery = useSettingsQuery();
  const settings = settingsQuery.data;
  const youTubeFetch = useYouTubeFetch();
  const serviceStatus = useServiceTranscriptStatusQuery();
  const ourKeyStatus = useOurKeyStatusQuery();
  const accountNeeded = useAccountNeeded();

  const provider = settings?.provider ?? DEFAULT_PROVIDER;
  const hasChosenKey = hasKeyFor(apiKeys, provider);
  const needsTranscriptSource = youTubeFetch === null && serviceStatus.data?.available !== true;
  const fallback = providersWithKeys(apiKeys).find((held) => held !== provider) ?? null;
  const ourKeyUsable = ourKeyStatus.data?.available === true;

  return {
    settled: !ourKeyStatus.isPending && !serviceStatus.isPending && !settingsQuery.isPending,
    ready: !accountNeeded && (hasChosenKey || ourKeyUsable) && !needsTranscriptSource,
    provider,
    hasChosenKey,
    fallback,
    ourKeyUsable,
    needsTranscriptSource,
    accountNeeded,
  };
};
