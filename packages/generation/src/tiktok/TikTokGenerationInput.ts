import type { TikTokSource, VideoSource } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";

// Written as a video, then given back its own source: docs/features/tiktok-links.md, "The note".
export interface TikTokGenerationInput extends GenerationInput {
  tiktok: TikTokSource;
}

const TITLE_CHARACTERS = 150;
const DESCRIPTION_CHARACTERS = 400;
const FULL_DESCRIPTION_CHARACTERS = 5000;

export const clipAsVideo = (tiktok: TikTokSource, caption: string): VideoSource => {
  const said = caption.trim();
  return {
    id: null,
    url: tiktok.url,
    title: tiktok.title.slice(0, TITLE_CHARACTERS),
    channel: tiktok.authorName.trim() === "" ? `@${tiktok.handle}` : tiktok.authorName,
    description: said === "" ? null : said.slice(0, DESCRIPTION_CHARACTERS),
    ...(said.length > DESCRIPTION_CHARACTERS ? { fullDescription: said.slice(0, FULL_DESCRIPTION_CHARACTERS) } : {}),
    durationMs: tiktok.durationMs,
    publishedAt: tiktok.publishedAt,
    thumbnailUrl: tiktok.imageUrl,
  };
};

export const isTikTokInput = (input: object): input is TikTokGenerationInput => "tiktok" in input;
