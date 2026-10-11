import { PROVIDER_CHOICE_LINE } from "../apiKeys/keyPrompt.js";
import type { GenerationReadiness } from "../newOverview/useGenerationReadiness.js";

const NO_TRANSCRIPT_SOURCE =
  "This browser has no way to fetch a transcript yet. The extension reads them from " +
  "YouTube on this device, for free.";

// What is missing, said in the words of the thing that is missing. Kept together so the
// states cannot drift apart across the surfaces that render them
// (docs/features/transcript-retrieval.md).
//
// The key half of this moved to keyPrompt when a key stopped being one thing
// (docs/features/byo-providers.md): what is left here is the transcript half, and the
// sentence that carries both when a reader has neither.
export const transcriptSourceNote = (readiness: GenerationReadiness): string | null =>
  readiness.needsTranscriptSource ? NO_TRANSCRIPT_SOURCE : null;

// The line under "Add an API key to write overviews." It names the six providers, and
// says the other missing thing too when both are missing, rather than sending the reader
// to Settings to discover the second one (design 110k).
export function keyPromptDetail(readiness: GenerationReadiness): string {
  return readiness.needsTranscriptSource
    ? `${PROVIDER_CHOICE_LINE} ${NO_TRANSCRIPT_SOURCE}`
    : PROVIDER_CHOICE_LINE;
}

// The link's own words, so a reader knows where it goes before pressing it.
export const settingsLinkLabel = (readiness: GenerationReadiness): string =>
  readiness.hasChosenKey ? "Set this up in Settings →" : "Add a key in Settings →";
