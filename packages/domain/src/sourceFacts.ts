import { formatClock } from "./formatClock.js";
import { parsePodcastLink } from "./parsePodcastLink.js";
import type { RecipeNote } from "./RecipeNote.js";
import { recipeMinutes } from "./recipeFacts.js";
import type { Source } from "./Source.js";

const ARTICLE_WORDS_PER_MINUTE = 230;

export const articleReadMinutes = (words: number): number => Math.max(1, Math.round(words / ARTICLE_WORDS_PER_MINUTE));

export const articleReadMs = (words: number): number => (words / ARTICLE_WORDS_PER_MINUTE) * 60_000;

export const domainOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

// Who the piece is from: the channel, or the site, or failing that its address.
export const sourceName = (source: Source): string => {
  if (source.kind === "youtube") return source.channel;
  if (source.kind === "podcast") return source.showName;
  return source.siteName ?? domainOf(source.url);
};

// Where the overview's way out goes: the video, the page, or for an episode the link the reader
// shared, never the feed's audio (docs/features/podcast-screens.md).
export const sourceUrl = (source: Source): string => (source.kind === "podcast" ? source.sharedFrom : source.url);

export type PodcastPlatform = "spotify" | "apple" | "page";

export function podcastPlatform(sharedFrom: string): PodcastPlatform {
  const link = parsePodcastLink(sharedFrom);
  if (link === null) return "page";
  if (link.platform === "apple" || link.platform === "apple-show") return "apple";
  if (link.platform === "page") return "page";
  return "spotify";
}

const OPEN_PODCAST: Record<PodcastPlatform, string> = {
  spotify: "Open in Spotify",
  apple: "Open in Apple Podcasts",
  page: "Open the show’s page",
};

// "Open in Spotify": the way back to where the reader came from (design 106n).
export const openPodcastLabel = (sharedFrom: string): string => OPEN_PODCAST[podcastPlatform(sharedFrom)];

// Where a recipe came from, as Copy and Print say it: "Kitchen with Ada on YouTube" (design 122r).
export const recipeFrom = (source: Source): string => (source.kind === "youtube" ? `${source.channel} on YouTube` : sourceName(source));

export const sourceImage = (source: Source): string | null => (source.kind === "youtube" ? (source.thumbnailUrl ?? null) : source.imageUrl);

// The words match the library's filter, so a reader connects the two. An episode is a podcast
// on its chip and an episode by its length: "Podcast", "1 hr 56 min episode" (design 106l).
const SOURCE_KIND: Record<Source["kind"], string> = { youtube: "video", web: "article", podcast: "episode" };
const KIND_CHIP: Record<Exclude<Source["kind"], "youtube">, string> = { web: "Article", podcast: "Podcast" };

const knownLength = (source: Source): string | null => {
  if (source.kind === "web") return `${articleReadMinutes(source.wordCount)} min`;
  if (source.kind === "podcast") return source.durationMs ? recipeMinutes(Math.round(source.durationMs / 60_000)) : null;
  return source.durationMs ? formatClock(source.durationMs / 1000) : null;
};

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

// "18:42 video", "14 min article", or "Video" when the length is not known: the kind is named
// on every card, never by an icon alone, and a missing length is never guessed (OV-232).
export function sourceLength(source: Source): string {
  const kind = SOURCE_KIND[source.kind];
  const length = knownLength(source);
  return length === null ? capitalised(kind) : `${length} ${kind}`;
}

// The chip a library row leads with. A video is most of the library and says so in its meta
// line, so it has none; any other kind does, and a recipe keeps its yield (design 232a, 232f).
export function kindChip(note: { source: Source; recipe?: RecipeNote | null | undefined }): string | null {
  if (note.recipe != null) return note.recipe.yield === null ? "Recipe" : `Recipe · ${note.recipe.yield}`;
  return note.source.kind === "youtube" ? null : KIND_CHIP[note.source.kind];
}

// A recipe names itself by the page's stated total, "1 hr 5 min recipe", or just "Recipe",
// never by a sum of prep and cook (design 144m); a recipe video by its length, "14:32 recipe
// video" (122n).
export function noteSourceLength(note: { source: Source; recipe?: RecipeNote | null | undefined }): string {
  if (note.recipe != null && note.source.kind === "youtube") {
    return note.source.durationMs ? `${formatClock(note.source.durationMs / 1000)} recipe video` : "Recipe video";
  }
  if (note.recipe != null) {
    return note.recipe.totalMinutes === null ? "Recipe" : `${recipeMinutes(note.recipe.totalMinutes)} recipe`;
  }
  return sourceLength(note.source);
}
