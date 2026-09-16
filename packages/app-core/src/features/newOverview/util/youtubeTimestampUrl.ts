export function youtubeTimestampUrl(videoUrl: string, startMs: number): string {
  const url = new URL(videoUrl);
  url.searchParams.set("t", String(Math.floor(startMs / 1000)));
  return url.toString();
}
