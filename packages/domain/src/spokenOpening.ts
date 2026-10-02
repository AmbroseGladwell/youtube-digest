import type { VideoSource } from "./VideoSource.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthAndYear = (iso: string) => {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

export function spokenOpening(video: VideoSource): string | null {
  const title = video.title.trim();
  const channel = video.channel.trim();
  const parts = [
    title === "" ? null : title,
    channel === "" ? null : `from ${channel}`,
    video.publishedAt === null ? null : `published in ${monthAndYear(video.publishedAt)}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `${parts.join(", ")}.`;
}
