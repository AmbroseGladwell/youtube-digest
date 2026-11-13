export function youtubeTimestampUrl(videoUrl: string, startMs: number): string {
  const url = new URL(videoUrl);
  url.searchParams.set("t", String(Math.floor(startMs / 1000)));
  return url.toString();
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

// A moment only links out on YouTube. An episode's times play its own audio in the note, and
// a link to Spotify or Apple at a time would land wherever that listen's ads put it, so with
// no player to move an episode's time is plain text (docs/features/podcast-notes.md).
export function youtubeMomentUrl(videoUrl: string, startMs: number): string | null {
  let host: string;
  try {
    host = new URL(videoUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return YOUTUBE_HOSTS.has(host) ? youtubeTimestampUrl(videoUrl, startMs) : null;
}
