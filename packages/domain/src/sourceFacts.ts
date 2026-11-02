import { formatClock } from "./formatClock.js";
import type { Source } from "./Source.js";

const ARTICLE_WORDS_PER_MINUTE = 230;

export const articleReadMinutes = (words: number): number => Math.max(1, Math.round(words / ARTICLE_WORDS_PER_MINUTE));

export const articleReadMs = (words: number): number => (words / ARTICLE_WORDS_PER_MINUTE) * 60_000;

const domainOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

// Who the piece is from: the channel, or the site, or failing that its address.
export const sourceName = (source: Source): string =>
  source.kind === "youtube" ? source.channel : (source.siteName ?? domainOf(source.url));

export const sourceImage = (source: Source): string | null =>
  source.kind === "youtube" ? (source.thumbnailUrl ?? null) : source.imageUrl;

// "18:42 video" or "14 min article": the kind is named on every card, never by an icon alone.
export function sourceLength(source: Source): string | null {
  if (source.kind === "web") return `${articleReadMinutes(source.wordCount)} min article`;
  return source.durationMs ? `${formatClock(source.durationMs / 1000)} video` : null;
}
