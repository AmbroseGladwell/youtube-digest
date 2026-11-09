import { formatClock } from "./formatClock.js";
import type { RecipeNote } from "./RecipeNote.js";
import { recipeMinutes } from "./recipeFacts.js";
import type { Source } from "./Source.js";

const ARTICLE_WORDS_PER_MINUTE = 230;

export const articleReadMinutes = (words: number): number => Math.max(1, Math.round(words / ARTICLE_WORDS_PER_MINUTE));

export const articleReadMs = (words: number): number => (words / ARTICLE_WORDS_PER_MINUTE) * 60_000;

export const domainOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

// Who the piece is from: the channel, or the site, or failing that its address.
export const sourceName = (source: Source): string =>
  source.kind === "youtube" ? source.channel : (source.siteName ?? domainOf(source.url));

// Where a recipe came from, as Copy and Print say it: "Kitchen with Ada on YouTube" (design 122r).
export const recipeFrom = (source: Source): string => (source.kind === "youtube" ? `${source.channel} on YouTube` : sourceName(source));

export const sourceImage = (source: Source): string | null => (source.kind === "youtube" ? (source.thumbnailUrl ?? null) : source.imageUrl);

// The words match the library's filter, so a reader connects the two.
const SOURCE_KIND: Record<Source["kind"], string> = { youtube: "video", web: "article" };

const knownLength = (source: Source): string | null => {
  if (source.kind === "web") return `${articleReadMinutes(source.wordCount)} min`;
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
  return note.source.kind === "youtube" ? null : capitalised(SOURCE_KIND[note.source.kind]);
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
