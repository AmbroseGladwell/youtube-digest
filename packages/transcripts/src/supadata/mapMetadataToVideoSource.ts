import type { Metadata } from "@supadata/js";
import { VideoSource } from "@overview/domain";

const publishedAt = (createdAt: string | null | undefined): string | null => {
  const parsed = createdAt === null || createdAt === undefined ? NaN : Date.parse(createdAt);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

export function mapMetadataToVideoSource(metadata: Metadata, url: string): VideoSource {
  return VideoSource.parse({
    id: metadata.id,
    url,
    title: metadata.title ?? "unavailable",
    channel: metadata.author.displayName,
    description: metadata.description?.slice(0, 400) ?? null,
    durationMs: metadata.media.type === "video" ? Math.round(metadata.media.duration * 1000) : null,
    publishedAt: publishedAt(metadata.createdAt),
    thumbnailUrl: metadata.media.type === "video" ? metadata.media.thumbnailUrl || null : null,
  });
}
