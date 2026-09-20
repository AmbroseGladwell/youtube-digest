import type { GenerationReadiness } from "../newOverview/useGenerationReadiness.js";

// What is missing, said in the words of the thing that is missing. Kept together so the
// three states cannot drift apart across the surfaces that render them
// (docs/features/transcript-retrieval.md).
const NOTES: Record<Exclude<GenerationReadiness, "ready">, string> = {
  "needs-anthropic-key": "Add your Anthropic key to write overviews.",
  "needs-transcript-source":
    "This browser has no way to fetch a transcript yet. The extension reads them from " +
    "YouTube on this device, for free.",
  "needs-both":
    "Add your Anthropic key to write overviews, and a way to fetch transcripts — the " +
    "extension reads them from YouTube on this device, for free.",
};

export const transcriptSourceNote = (readiness: GenerationReadiness): string | null =>
  readiness === "ready" ? null : NOTES[readiness];

// The link's own words, so a reader knows where it goes before pressing it.
export const settingsLinkLabel = (readiness: GenerationReadiness): string =>
  readiness === "needs-anthropic-key" ? "Add your key in Settings →" : "Set this up in Settings →";
