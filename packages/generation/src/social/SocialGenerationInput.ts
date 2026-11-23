import {
  FULL_DESCRIPTION_MOST,
  SOCIAL_PLATFORM_NAME,
  sourceName,
  type ExtractedArticle,
  type SocialSource,
  type VideoSource,
  type WrittenPost,
} from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";
import type { ArticleGenerationInput } from "../article/ArticleGenerationInput.js";

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

export const isSocialInput = (input: object): input is SocialGenerationInput => "social" in input && "video" in input;

// A photo or text post is its description, so it is written as a short article is (docs/features/social-posts.md).
export type WrittenPostGenerationInput = ArticleGenerationInput & { social: WrittenPost };

export const isWrittenPostInput = (input: object): input is WrittenPostGenerationInput => "social" in input && "article" in input;

const BLANK_LINES = /\n[ \t]*(?:\n[ \t]*)+/g;

// Null for a description with nothing in it, which has nothing to write from.
export const postAsArticle = (post: WrittenPost, description: string): ExtractedArticle | null => {
  const written = description.trim().slice(0, FULL_DESCRIPTION_MOST).replace(BLANK_LINES, "\n\n");
  if (written === "" || post.wordCount === 0) {
    return null;
  }
  return {
    url: post.url,
    title: post.title,
    siteName: SOCIAL_PLATFORM_NAME[post.kind],
    author: sourceName(post),
    publishedAt: post.publishedAt,
    language: null,
    imageUrl: post.imageUrl,
    sections: [{ heading: null, anchor: null, text: written, links: [] }],
    wordCount: post.wordCount,
    recipe: null,
  };
};
