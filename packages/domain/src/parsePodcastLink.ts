export type PodcastLink =
  | { platform: "apple"; showId: string; episodeId: string }
  | { platform: "spotify"; episodeId: string }
  | { platform: "spotify-short"; url: string }
  | { platform: "apple-show" }
  | { platform: "spotify-show" }
  | { platform: "page"; url: string };

const APPLE_HOSTS = new Set(["podcasts.apple.com", "itunes.apple.com"]);
const SPOTIFY_HOSTS = new Set(["open.spotify.com", "play.spotify.com"]);
const SPOTIFY_SHORT_HOSTS = new Set(["spotify.link", "spotify.app.link"]);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

function spotifyPath(segments: readonly string[]): PodcastLink | null {
  const parts = segments[0]?.startsWith("intl-") ? segments.slice(1) : segments;
  const [type, id] = parts;
  if (type === "show") return { platform: "spotify-show" };
  if (type === "episode" && id !== undefined && SPOTIFY_ID.test(id)) return { platform: "spotify", episodeId: id };
  return null;
}

// Which kind of podcast link this is, from its shape alone (docs/features/podcast-links.md).
// Any other web address is a page that may be a show's own episode page.
export function parsePodcastLink(link: string): PodcastLink | null {
  const uri = /^spotify:(episode|show):([A-Za-z0-9]{22})$/.exec(link.trim());
  if (uri !== null) return spotifyPath([uri[1]!, uri[2]!]);

  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter((segment) => segment !== "");

  if (APPLE_HOSTS.has(host)) {
    const showId = segments.map((segment) => /^id(\d+)$/.exec(segment)?.[1]).find((id) => id !== undefined);
    const episodeId = url.searchParams.get("i");
    if (showId === undefined) return null;
    return episodeId !== null && /^\d+$/.test(episodeId) ? { platform: "apple", showId, episodeId } : { platform: "apple-show" };
  }
  if (SPOTIFY_HOSTS.has(host)) return spotifyPath(segments);
  if (SPOTIFY_SHORT_HOSTS.has(host)) return { platform: "spotify-short", url: url.href };
  return { platform: "page", url: url.href };
}
