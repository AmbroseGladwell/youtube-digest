import type { ModelListing } from "../ProviderAdapter.js";

// A provider that will not say what each model is for leaves us to read its names. These
// are the families that certainly cannot write an overview: everything that makes or reads
// pictures, sound and numbers rather than prose.
//
// The test is deliberately one-sided. A model wrongly dropped is one a reader cannot pick
// at all; a model wrongly kept is one they can pick and will see fail once, with the raw
// id in front of them. So anything these patterns do not recognise is offered.
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

export function usableModels(ids: readonly string[]): ModelListing {
  const unique = [...new Set(ids)];
  const usable = unique.filter(canWriteAnOverview).sort();
  return { usable, unusable: unique.length - usable.length };
}
