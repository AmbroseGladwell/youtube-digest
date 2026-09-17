import type { Metadata } from "@supadata/js";
import { VideoSource } from "@overview/types";

export function mapMetadataToVideoSource(metadata: Metadata, url: string): VideoSource {
  return VideoSource.parse({
    id: metadata.id,
    url,
    title: metadata.title ?? "unavailable",
    channel: metadata.author.displayName,
    description: metadata.description?.slice(0, 400) ?? null,
    durationMs: metadata.media.type === "video" ? Math.round(metadata.media.duration * 1000) : null,
    thumbnailUrl: metadata.media.type === "video" ? metadata.media.thumbnailUrl || null : null,
  });
}
