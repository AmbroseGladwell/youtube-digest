import type { PageMeta } from "./pageMeta.js";
import type { EpisodeFacts } from "./sameEpisode.js";

export interface SpotifyEpisodeFacts extends EpisodeFacts {
  title: string;
  showName: string | null;
}

const SHOW_IN_DESCRIPTION = /^Listen to this episode from (.+?) on Spotify\./;
const SHOW_IN_OG_DESCRIPTION = /^(.+?) · Episode$/;

// What a Spotify episode's page tells any link preview: no API key, no account.
export function spotifyEpisodeFacts({ meta }: PageMeta): SpotifyEpisodeFacts | null {
  const title = meta.get("og:title");
  if (title === undefined || title === "") return null;
  const showName =
    SHOW_IN_DESCRIPTION.exec(meta.get("description") ?? "")?.[1] ??
    SHOW_IN_OG_DESCRIPTION.exec(meta.get("og:description") ?? "")?.[1] ??
    null;
  const released = Date.parse(meta.get("music:release_date") ?? "");
  const duration = Number(meta.get("music:duration"));
  return {
    title,
    showName,
    publishedAt: Number.isNaN(released) ? null : new Date(released).toISOString(),
    durationSeconds: Number.isInteger(duration) && duration > 0 ? duration : null,
  };
}
