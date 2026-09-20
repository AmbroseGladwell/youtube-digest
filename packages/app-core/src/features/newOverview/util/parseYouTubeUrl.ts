const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

function stripHostPrefix(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

// Cheap client-side validation, not a duplicate of what a source checks for itself —
// this exists only to reject an obviously-not-YouTube paste before a rung is asked, and
// to give the InnerTube rung the id it needs (docs/features/transcript-retrieval.md).
export function extractYouTubeVideoId(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;
  const host = stripHostPrefix(parsed.hostname);

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id ? id : null;
  }

  const watchId = parsed.searchParams.get("v");
  if (watchId) return watchId;

  const shortsMatch = /^\/shorts\/([^/]+)/.exec(parsed.pathname);
  if (shortsMatch?.[1]) return shortsMatch[1];

  const embedMatch = /^\/embed\/([^/]+)/.exec(parsed.pathname);
  if (embedMatch?.[1]) return embedMatch[1];

  return null;
}

export function isYouTubeUrl(input: string): boolean {
  return extractYouTubeVideoId(input) !== null;
}
