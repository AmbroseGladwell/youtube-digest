import { z } from "zod";
import { VideoSource, type VideoId } from "@overview/domain";
import type { YouTubeFetch } from "@overview/transcripts";
import { isoDurationSeconds } from "../podcasts/youTubeDataApiEpisodes.js";
import { youTubeDataApiGet } from "../youTubeDataApi/youTubeDataApiGet.js";

const SHORT_DESCRIPTION_CHARACTERS = 400;
const FULL_DESCRIPTION_CHARACTERS = 5000;
const THUMBNAILS_WIDEST_FIRST = ["maxres", "standard", "high", "medium", "default"] as const;

const VideosResponse = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        title: z.string(),
        channelTitle: z.string(),
        description: z.string().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
        thumbnails: z.record(z.string(), z.object({ url: z.url() })).optional(),
      }),
      contentDetails: z.object({ duration: z.string().optional() }).optional(),
    }),
  ),
});

export type VideoReader = (videoId: VideoId) => Promise<VideoSource | null>;

export interface YouTubeDataApiVideoReaderOptions {
  apiKey: string;
  youTubeFetch: YouTubeFetch;
}

// One quota unit and no model, so onboarding can show its card before there's an account.
export const youTubeDataApiVideoReader = ({ apiKey, youTubeFetch }: YouTubeDataApiVideoReaderOptions): VideoReader => {
  const get = youTubeDataApiGet({ apiKey, youTubeFetch });
  return async (videoId) => {
    const answer = await get("videos", { part: "snippet,contentDetails", id: videoId }, VideosResponse);
    const item = answer?.items[0];
    if (item === undefined) {
      return null;
    }
    const { snippet } = item;
    const description = snippet.description ?? "";
    const seconds = isoDurationSeconds(item.contentDetails?.duration);
    const widest = THUMBNAILS_WIDEST_FIRST.map((size) => snippet.thumbnails?.[size]?.url).find((url) => url !== undefined);
    return VideoSource.parse({
      id: item.id,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`,
      title: snippet.title,
      channel: snippet.channelTitle,
      description: description.slice(0, SHORT_DESCRIPTION_CHARACTERS) || null,
      ...(description === "" ? {} : { fullDescription: description.slice(0, FULL_DESCRIPTION_CHARACTERS) }),
      durationMs: seconds === null ? null : seconds * 1000,
      publishedAt: snippet.publishedAt === undefined ? null : new Date(snippet.publishedAt).toISOString(),
      thumbnailUrl: widest ?? null,
    });
  };
};
