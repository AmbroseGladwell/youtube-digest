import { sourceKey, type Source, type VideoSource } from "@overview/domain";

// What the reader's times, transcript and chapters read: a video as it is, an episode in a
// video's shape, keyed by its source key as its transcript is stored (podcastTranscript.ts),
// and pointing at the link the reader shared. A page has no times.
export function timedSource(source: Source): VideoSource | null {
  if (source.kind === "youtube") return source;
  if (source.kind === "web") return null;
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
}

// What a time control says it moves: "Play the episode from 14:20". A timed source's id is its
// source key, which names any kind but YouTube (docs/features/source-identity.md).
export const timedNoun = (video: Pick<VideoSource, "id">): "video" | "episode" => (video.id?.startsWith("podcast:") ? "episode" : "video");
