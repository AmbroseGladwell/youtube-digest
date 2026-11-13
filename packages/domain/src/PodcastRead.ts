import { z } from "zod";
import { PodcastEpisode } from "./PodcastEpisode.js";

export const PodcastReadFailure = z.enum(["not-an-episode", "not-found", "no-public-feed", "feed-unreadable", "no-answer"]);
export type PodcastReadFailure = z.infer<typeof PodcastReadFailure>;

export const PodcastRead = z.discriminatedUnion("status", [
  z.object({ status: z.literal("read"), episode: PodcastEpisode }),
  z.object({ status: z.literal("failed"), reason: PodcastReadFailure, showName: z.string().nullish() }),
]);
export type PodcastRead = z.infer<typeof PodcastRead>;
