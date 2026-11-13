import { z } from "zod";
import type { SourceKey } from "./Brands.js";

export const PodcastLinkFrom = z.enum(["apple", "spotify", "page"]);
export type PodcastLinkFrom = z.infer<typeof PodcastLinkFrom>;

export const PodcastTranscriptLink = z.object({
  url: z.url(),
  type: z.string(),
  language: z.string().nullable(),
});
export type PodcastTranscriptLink = z.infer<typeof PodcastTranscriptLink>;

// One episode as its show's own feed describes it (docs/features/podcast-links.md).
export const PodcastEpisode = z.object({
  feedUrl: z.url(),
  guid: z.string().min(1),
  title: z.string().min(1),
  showName: z.string().min(1),
  publishedAt: z.iso.datetime().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  audioUrl: z.url(),
  pageUrl: z.url().nullable(),
  imageUrl: z.url().nullable(),
  notes: z.string(),
  // Its notes' own words, less what the show repeats in every episode, for telling a retitled
  // upload apart (docs/features/podcast-on-youtube.md).
  notesKeywords: z.array(z.string()),
  transcripts: z.array(PodcastTranscriptLink),
  chaptersUrl: z.url().nullable(),
  linkFrom: PodcastLinkFrom,
});
export type PodcastEpisode = z.infer<typeof PodcastEpisode>;

// The feed and its guid together, since a guid is only promised unique within its feed.
export async function podcastSourceId({ feedUrl, guid }: Pick<PodcastEpisode, "feedUrl" | "guid">): Promise<SourceKey> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${feedUrl}\n${guid}`));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 32) as SourceKey;
}
