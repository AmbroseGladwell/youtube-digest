export const youtubeTimestampUrl = (videoUrl: string, startMs: number): string => {
  const url = new URL(videoUrl);
  url.searchParams.set("t", String(Math.floor(startMs / 1000)));
  return url.toString();
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

// Only YouTube: an episode's time links would land where ads put it (docs/features/podcast-notes.md).
export const youtubeMomentUrl = (videoUrl: string, startMs: number): string | null => {
  let host: string;
  try {
    host = new URL(videoUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return YOUTUBE_HOSTS.has(host) ? youtubeTimestampUrl(videoUrl, startMs) : null;
};
