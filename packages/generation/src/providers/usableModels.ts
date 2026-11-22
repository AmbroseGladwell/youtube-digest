import type { ModelListing } from "../ProviderAdapter.js";

// Deliberately one-sided: docs/features/byo-providers.md, "Which models are offered".
const CANNOT_WRITE_PROSE = [
  "embed",
  "embedding",
  "moderation",
  "whisper",
  "tts",
  "audio",
  "speech",
  "transcribe",
  "realtime",
  "dall-e",
  "image",
  "vision-encoder",
  "rerank",
  "guard",
  "ocr",
  "video",
];

export const canWriteAnOverview = (id: string): boolean => {
  const name = id.toLowerCase();
  return !CANNOT_WRITE_PROSE.some((family) => name.includes(family));
};

export const usableModels = (ids: readonly string[]): ModelListing => {
  const unique = [...new Set(ids)];
  const usable = unique.filter(canWriteAnOverview).sort();
  return { usable, unusable: unique.length - usable.length };
};
