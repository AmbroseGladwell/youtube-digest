import { z } from "zod";
import { PodcastEpisode } from "./PodcastEpisode.js";

// `not-listed`: an Apple link to an episode older than the newest 200 Apple's directory lists,
// which we don't read Apple's pages to find (OV-297).
export const PodcastReadFailure = z.enum(["not-an-episode", "not-found", "no-public-feed", "feed-unreadable", "no-answer", "not-listed"]);
export type PodcastReadFailure = z.infer<typeof PodcastReadFailure>;

export const PodcastRead = z.discriminatedUnion("status", [
  z.object({ status: z.literal("read"), episode: PodcastEpisode }),
  z.object({ status: z.literal("failed"), reason: PodcastReadFailure, showName: z.string().nullish() }),
]);
export type PodcastRead = z.infer<typeof PodcastRead>;
