import { PROVIDER_CHOICE_LINE } from "../apiKeys/keyPrompt.js";
import type { GenerationReadiness } from "../newOverview/useGenerationReadiness.js";

const NO_TRANSCRIPT_SOURCE =
  "This browser has no way to fetch a transcript yet. The extension reads them from " + "YouTube on this device, for free.";

// Why these live together: docs/features/transcript-retrieval.md, "What the app says about all this".
export const transcriptSourceNote = (readiness: GenerationReadiness): string | null =>
  readiness.needsTranscriptSource ? NO_TRANSCRIPT_SOURCE : null;

export const keyPromptDetail = (readiness: GenerationReadiness): string => {
  return readiness.needsTranscriptSource ? `${PROVIDER_CHOICE_LINE} ${NO_TRANSCRIPT_SOURCE}` : PROVIDER_CHOICE_LINE;
};

export const settingsLinkLabel = (readiness: GenerationReadiness): string =>
  readiness.hasChosenKey ? "Set this up in Settings →" : "Add a key in Settings →";
