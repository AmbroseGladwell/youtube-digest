import { formatClock } from "./formatClock.js";
import { parsePodcastLink } from "./parsePodcastLink.js";
import type { RecipeNote } from "./RecipeNote.js";
import { recipeMinutes } from "./recipeFacts.js";
import type { Source } from "./Source.js";

const ARTICLE_WORDS_PER_MINUTE = 230;

export const articleReadMinutes = (words: number): number => Math.max(1, Math.round(words / ARTICLE_WORDS_PER_MINUTE));

export const articleReadMs = (words: number): number => (words / ARTICLE_WORDS_PER_MINUTE) * 60_000;

export const domainOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

// The channel, or the site, or failing that its address.
export const sourceName = (source: Source): string => {
  if (source.kind === "youtube") {
    return source.channel;
  }
  if (source.kind === "podcast") {
    return source.showName;
  }
  if (source.kind === "tiktok") {
    return source.authorName.trim() === "" ? `@${source.handle}` : source.authorName;
  }
  return source.siteName ?? domainOf(source.url);
};

// For an episode the shared link, never the feed's audio (docs/features/podcast-screens.md).
export const sourceUrl = (source: Source): string => (source.kind === "podcast" ? source.sharedFrom : source.url);

export type PodcastPlatform = "spotify" | "apple" | "page";

export const podcastPlatform = (sharedFrom: string): PodcastPlatform => {
  const link = parsePodcastLink(sharedFrom);
  if (link === null) {
    return "page";
  }
  if (link.platform === "apple" || link.platform === "apple-show") {
    return "apple";
  }
  if (link.platform === "page") {
    return "page";
  }
  return "spotify";
};

const OPEN_PODCAST: Record<PodcastPlatform, string> = {
  spotify: "Listen on Spotify",
  apple: "Listen on Apple Podcasts",
  page: "Open the show’s page",
};

// The way back, in the words Apple's and Spotify's guidelines ask for (design 106n, OV-297).
export const openPodcastLabel = (sharedFrom: string): string => OPEN_PODCAST[podcastPlatform(sharedFrom)];

// As Copy and Print say it: "Kitchen with Ada on YouTube" (design 122r).
export const recipeFrom = (source: Source): string => {
  if (source.kind === "youtube") {
    return `${source.channel} on YouTube`;
  }
  return source.kind === "tiktok" ? `${sourceName(source)} on TikTok` : sourceName(source);
};

export const sourceImage = (source: Source): string | null => (source.kind === "youtube" ? (source.thumbnailUrl ?? null) : source.imageUrl);

// Matches the library's filter: "Podcast" on its chip, "1 hr 56 min episode" by length (design 106l).
const SOURCE_KIND: Record<Source["kind"], string> = { youtube: "video", web: "article", podcast: "episode", tiktok: "video" };
const KIND_CHIP: Record<Exclude<Source["kind"], "youtube">, string> = { web: "Article", podcast: "Podcast", tiktok: "TikTok" };

const knownLength = (source: Source): string | null => {
  if (source.kind === "web") {
    return `${articleReadMinutes(source.wordCount)} min`;
  }
  if (source.kind === "podcast") {
    return source.durationMs ? recipeMinutes(Math.round(source.durationMs / 60_000)) : null;
  }
  // Design 130g: a clip under a minute in seconds, "58 s video".
  if (source.kind === "tiktok" && source.durationMs !== null && source.durationMs < 59_500) {
    return `${Math.round(source.durationMs / 1000)} s`;
  }
  return source.durationMs ? formatClock(source.durationMs / 1000) : null;
};

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

// The kind is always named, and a missing length is never guessed (OV-232).
export const sourceLength = (source: Source): string => {
  const kind = SOURCE_KIND[source.kind];
  const length = knownLength(source);
  return length === null ? capitalised(kind) : `${length} ${kind}`;
};

export interface SourcedNote {
  source: Source;
  recipe?: RecipeNote | null | undefined;
}

// None on a video, most of the library; a recipe keeps its yield (design 232a, 232f).
export const kindChip = (note: SourcedNote): string | null => {
  if (note.recipe != null) {
    return note.recipe.yield === null ? "Recipe" : `Recipe · ${note.recipe.yield}`;
  }
  return note.source.kind === "youtube" ? null : KIND_CHIP[note.source.kind];
};

// The page's stated total, never prep plus cook (design 144m); a recipe video by length (122n).
export const noteSourceLength = (note: SourcedNote): string => {
  if (note.recipe != null && (note.source.kind === "youtube" || note.source.kind === "tiktok")) {
    return note.source.durationMs ? `${formatClock(note.source.durationMs / 1000)} recipe video` : "Recipe video";
  }
  if (note.recipe != null) {
    return note.recipe.totalMinutes === null ? "Recipe" : `${recipeMinutes(note.recipe.totalMinutes)} recipe`;
  }
  return sourceLength(note.source);
};
