import { FULL_DESCRIPTION_MOST, sourceName, type SocialSource, type VideoSource } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";

// Written as a video, then given back its own source: docs/features/social-posts.md, "The note".
export interface SocialGenerationInput extends GenerationInput {
  social: SocialSource;
}

const TITLE_CHARACTERS = 150;
const DESCRIPTION_CHARACTERS = 400;

// The whole description goes to the model: on these platforms it often carries the post itself.
export const postAsVideo = (social: SocialSource, description: string): VideoSource => {
  const written = description.trim();
  return {
    id: null,
    url: social.url,
    title: social.title.slice(0, TITLE_CHARACTERS),
    channel: sourceName(social),
    description: written === "" ? null : written.slice(0, DESCRIPTION_CHARACTERS),
    ...(written.length > DESCRIPTION_CHARACTERS ? { fullDescription: written.slice(0, FULL_DESCRIPTION_MOST) } : {}),
    durationMs: social.durationMs,
    publishedAt: social.publishedAt,
    thumbnailUrl: social.imageUrl,
  };
};

export const isSocialInput = (input: object): input is SocialGenerationInput => "social" in input;
