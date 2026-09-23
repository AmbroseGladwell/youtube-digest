import { VideoSource } from "@overview/domain";
import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";
import { innerTubeError } from "./innerTubeFailure.js";
import type { PlayerResponse } from "./PlayerResponse.js";

const UNAVAILABLE = "unavailable";

// lengthSeconds is a string, and "0" for anything live. VideoSource.durationMs is
// positive-or-null, so a live stream has no duration rather than a duration of nothing.
const durationMs = (lengthSeconds: string | undefined): number | null => {
  const seconds = Number(lengthSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null;
};

const publishedAt = (raw: string | undefined): string | null => {
  const parsed = raw === undefined ? NaN : Date.parse(raw);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

// YouTube's own resolved thumbnails, widest first. Never assembled from the video id:
// the rule in packages/domain/src/VideoSource.ts outlives the source it was written for.
const widestThumbnail = (response: PlayerResponse): string | null => {
  const thumbnails = response.videoDetails?.thumbnail?.thumbnails ?? [];
  const widest = thumbnails.reduce<{ url: string; width: number } | null>(
    (best, candidate) => (best === null || candidate.width > best.width ? candidate : best),
    null,
  );
  return widest?.url || null;
};

export function mapPlayerResponseToVideoSource(
  response: PlayerResponse,
  url: string,
  metadata?: PlayerResponse | undefined,
): VideoSource {
  const details = response.videoDetails;
  if (!details?.videoId) {
    throw innerTubeError(
      "the player response carried no video id",
      TranscriptFetchFailure.MALFORMED_RESPONSE,
    );
  }

  const microformat = (metadata ?? response).microformat?.playerMicroformatRenderer;

  return VideoSource.parse({
    id: details.videoId,
    url,
    title: details.title ?? UNAVAILABLE,
    channel: details.author ?? UNAVAILABLE,
    description: details.shortDescription?.slice(0, 400) || null,
    durationMs: durationMs(details.lengthSeconds),
    publishedAt: publishedAt(microformat?.publishDate ?? microformat?.uploadDate),
    thumbnailUrl: widestThumbnail(response),
  });
}
