import type { VideoSource } from "@overview/domain";

const SLUG_LIMIT = 60;

export function transcriptFileName(video: VideoSource): string {
  const slug = video.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_LIMIT)
    .replace(/-+$/, "");
  return `${slug === "" ? "transcript" : `${slug}-transcript`}.txt`;
}
