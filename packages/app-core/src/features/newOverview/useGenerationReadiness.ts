import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";

export type GenerationReadiness =
  | "ready"
  | "needs-anthropic-key"
  | "needs-transcript-source"
  | "needs-both";

// A transcript no longer has one source, so "have you pasted both keys" is the wrong
// question: a shell that can reach YouTube needs no transcript key at all
// (docs/features/transcript-retrieval.md).
export function useGenerationReadiness(): GenerationReadiness {
  const { apiKeys } = useApiKeys();
  const youTubeFetch = useYouTubeFetch();

  const hasAnthropic = apiKeys.anthropicApiKey !== null;
  const hasTranscriptSource = youTubeFetch !== null || apiKeys.supadataApiKey !== null;

  if (hasAnthropic && hasTranscriptSource) return "ready";
  if (hasAnthropic) return "needs-transcript-source";
  if (hasTranscriptSource) return "needs-anthropic-key";
  return "needs-both";
}
