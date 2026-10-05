import { PlaylistId } from "@overview/domain";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIDEO_PATH = /^\/(?:shorts|embed|live|v)\/([^/]+)/;

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

  return VIDEO_PATH.exec(parsed.pathname)?.[1] ?? null;
}

export function isYouTubeUrl(input: string): boolean {
  return extractYouTubeVideoId(input) !== null;
}

export function canonicalYouTubeUrl(input: string): string | null {
  const id = extractYouTubeVideoId(input);
  return id === null ? null : `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

// Lists YouTube keeps to the viewer, and the Mix it makes up on the fly for each one: none
// can be read by an app (docs/features/playlists.md, "Playlists that can't be followed").
export type UnfollowableList = "watchLater" | "liked" | "mix";

export type YouTubeLink =
  | { kind: "video"; videoUrl: string }
  | { kind: "videoInPlaylist"; videoUrl: string; playlistId: PlaylistId }
  | { kind: "playlist"; playlistId: PlaylistId }
  | { kind: "unfollowable"; list: UnfollowableList; videoUrl: string | null };

function unfollowableList(listId: string): UnfollowableList | null {
  if (listId === "WL") return "watchLater";
  if (listId === "LL" || listId === "LM") return "liked";
  if (listId.startsWith("RD")) return "mix";
  return null;
}

// What a pasted link points at, so every paste field can tell a video from a playlist
// before anything starts (docs/features/playlists.md, "Pasting a link").
export function youTubeLink(input: string): YouTubeLink | null {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;

  const videoUrl = canonicalYouTubeUrl(input);
  const listId = parsed.searchParams.get("list");
  if (listId === null || listId === "") {
    return videoUrl === null ? null : { kind: "video", videoUrl };
  }

  const unfollowable = unfollowableList(listId);
  if (unfollowable === "mix") return { kind: "unfollowable", list: "mix", videoUrl };
  if (unfollowable !== null) {
    return videoUrl === null ? { kind: "unfollowable", list: unfollowable, videoUrl: null } : { kind: "video", videoUrl };
  }

  const playlistId = PlaylistId.parse(listId);
  return videoUrl === null ? { kind: "playlist", playlistId } : { kind: "videoInPlaylist", videoUrl, playlistId };
}

export const playlistUrl = (playlistId: PlaylistId): string =>
  `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
