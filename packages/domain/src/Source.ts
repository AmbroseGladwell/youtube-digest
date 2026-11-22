import { z } from "zod";
import { SourceKey } from "./Brands.js";
import type { ExtractedArticle } from "./ExtractedArticle.js";
import type { PodcastEpisode } from "./PodcastEpisode.js";
import { VideoSource } from "./VideoSource.js";

export const YouTubeSource = VideoSource.extend({ kind: z.literal("youtube") });
export type YouTubeSource = z.infer<typeof YouTubeSource>;

// A new kind joins the union and the compiler names every reader (docs/features/source-identity.md).
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

// The feed's identity; sharedFrom is the pasted page, the way back (docs/features/podcast-screens.md).
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

// Short, path-safe and the same for every reader (docs/features/source-identity.md).
export const articleSourceId = async (url: string): Promise<SourceKey> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 32) as SourceKey;
};

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

const SHARER_PARAMETERS = /^(si|utm_.+|context|nd|_branch_match_id|_branch_referrer)$/;

// Spotify's si= ties to the sharer's account, so it and campaign params go (docs/features/podcast-screens.md).
export const keptSharedLink = (link: string): string => {
  const uri = /^spotify:(episode|show):([A-Za-z0-9]{22})$/.exec(link.trim());
  if (uri !== null) {
    return `https://open.spotify.com/${uri[1]}/${uri[2]}`;
  }
  const url = new URL(link.trim());
  for (const name of [...url.searchParams.keys()]) {
    if (SHARER_PARAMETERS.test(name)) {
      url.searchParams.delete(name);
    }
  }
  url.hash = "";
  return url.toString();
};

export const podcastSource = (episode: PodcastEpisode, id: SourceKey, sharedFrom: string): PodcastSource => ({
  kind: "podcast",
  id,
  feedUrl: episode.feedUrl,
  guid: episode.guid,
  title: episode.title,
  showName: episode.showName,
  publishedAt: episode.publishedAt,
  durationMs: episode.durationSeconds === null ? null : episode.durationSeconds * 1000,
  audioUrl: episode.audioUrl,
  pageUrl: episode.pageUrl,
  imageUrl: episode.imageUrl,
  sharedFrom: keptSharedLink(sharedFrom),
});
