import { z } from "zod";
import { SourceKey } from "./Brands.js";
import type { ExtractedArticle } from "./ExtractedArticle.js";
import { VideoSource } from "./VideoSource.js";

export const YouTubeSource = VideoSource.extend({ kind: z.literal("youtube") });
export type YouTubeSource = z.infer<typeof YouTubeSource>;

// What an overview is of. Each kind carries the fields it has, so a new kind joins this union
// and the compiler names every reader that assumed a video (docs/features/source-identity.md).
export const WebSource = z.object({
  kind: z.literal("web"),
  id: SourceKey,
  url: z.url(),
  title: z.string(),
  siteName: z.string().nullable(),
  author: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  language: z.string().nullable(),
  imageUrl: z.url().nullable(),
  wordCount: z.number().int().positive(),
});
export type WebSource = z.infer<typeof WebSource>;

// One episode of a show, as its own feed names it: the identity is the feed's, never the Apple or
// Spotify page it was shared from. `sharedFrom` is that page, the link this reader pasted: the
// overview's way out, since a reader who came from Spotify goes back to Spotify
// (docs/features/podcast-screens.md).
export const PodcastSource = z.object({
  kind: z.literal("podcast"),
  id: SourceKey,
  feedUrl: z.url(),
  guid: z.string().min(1),
  title: z.string(),
  showName: z.string(),
  publishedAt: z.iso.datetime().nullable(),
  durationMs: z.number().int().positive().nullable(),
  audioUrl: z.url(),
  pageUrl: z.url().nullable(),
  imageUrl: z.url().nullable(),
  sharedFrom: z.url(),
});
export type PodcastSource = z.infer<typeof PodcastSource>;

export const Source = z.discriminatedUnion("kind", [YouTubeSource, WebSource, PodcastSource]);
export type Source = z.infer<typeof Source>;

// A hash of the canonical address, so the id is short, safe in a path, and the same for every
// reader of the page (docs/features/source-identity.md).
export async function articleSourceId(url: string): Promise<SourceKey> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 32) as SourceKey;
}

export const webSource = (article: ExtractedArticle, id: SourceKey): WebSource => ({
  kind: "web",
  id,
  url: article.url,
  title: article.title,
  siteName: article.siteName,
  author: article.author,
  publishedAt: article.publishedAt,
  language: article.language,
  imageUrl: article.imageUrl,
  wordCount: article.wordCount,
});

export const youTubeSource = ({ fullDescription: _forGenerationOnly, ...video }: VideoSource): YouTubeSource => ({
  ...video,
  kind: "youtube",
});
