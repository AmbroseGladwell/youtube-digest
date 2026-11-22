import { sourceKey, type Source, type VideoSource } from "@overview/domain";

export const timedSource = (source: Source): VideoSource | null => {
  if (source.kind === "youtube") {
    return source;
  }
  if (source.kind === "web") {
    return null;
  }
  return {
    id: sourceKey(source),
    url: source.sharedFrom,
    title: source.title,
    channel: source.showName,
    description: null,
    durationMs: source.durationMs,
    publishedAt: source.publishedAt,
    thumbnailUrl: source.imageUrl,
  };
};

// A timed source's id is its source key: docs/features/source-identity.md, "Why YouTube's key is unprefixed".
export const timedNoun = (video: Pick<VideoSource, "id">): "video" | "episode" => (video.id?.startsWith("podcast:") ? "episode" : "video");

type TimedNoun = ReturnType<typeof timedNoun>;

export const playingLabel = (noun: TimedNoun): string => (noun === "episode" ? "Playing" : "Playing on YouTube");

// "Auto-generated" is YouTube's word; an episode's words come from elsewhere, so it says what they are.
export const machineTranscribedLabel = (noun: TimedNoun): string => (noun === "episode" ? "Machine-transcribed" : "Auto-generated");
