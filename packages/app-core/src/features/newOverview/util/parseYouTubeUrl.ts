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

// No colon: docs/features/source-identity.md, "Why YouTube's key is unprefixed".
const VIDEO_ID = /^[A-Za-z0-9_-]+$/;

const stripHostPrefix = (host: string): string => {
  return host.startsWith("www.") ? host.slice(4) : host;
};

// Only rejects an obviously-not-YouTube paste before a rung is asked; sources check for themselves.
export const extractYouTubeVideoId = (input: string): string | null => {
  const id = idInYouTubeUrl(input);
  return id !== null && VIDEO_ID.test(id) ? id : null;
};

const idInYouTubeUrl = (input: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
    return null;
  }
  const host = stripHostPrefix(parsed.hostname);

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id ? id : null;
  }

  const watchId = parsed.searchParams.get("v");
  if (watchId) {
    return watchId;
  }

  return VIDEO_PATH.exec(parsed.pathname)?.[1] ?? null;
};

export const isYouTubeUrl = (input: string): boolean => {
  return extractYouTubeVideoId(input) !== null;
};

export const canonicalYouTubeUrl = (input: string): string | null => {
  const id = extractYouTubeVideoId(input);
  return id === null ? null : `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
};

// None of these can be read by an app: docs/features/playlists.md, "Pasting a link".
export type UnfollowableList = "watchLater" | "liked" | "mix";

export type YouTubeLink =
  | { kind: "video"; videoUrl: string }
  | { kind: "videoInPlaylist"; videoUrl: string; playlistId: PlaylistId }
  | { kind: "playlist"; playlistId: PlaylistId }
  | { kind: "unfollowable"; list: UnfollowableList; videoUrl: string | null };

const unfollowableList = (listId: string): UnfollowableList | null => {
  if (listId === "WL") {
    return "watchLater";
  }
  if (listId === "LL" || listId === "LM") {
    return "liked";
  }
  if (listId.startsWith("RD")) {
    return "mix";
  }
  return null;
};

// docs/features/playlists.md, "Pasting a link".
export const youTubeLink = (input: string): YouTubeLink | null => {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
    return null;
  }

  const videoUrl = canonicalYouTubeUrl(input);
  const listId = parsed.searchParams.get("list");
  if (listId === null || listId === "") {
    return videoUrl === null ? null : { kind: "video", videoUrl };
  }

  const unfollowable = unfollowableList(listId);
  if (unfollowable === "mix") {
    return { kind: "unfollowable", list: "mix", videoUrl };
  }
  if (unfollowable !== null) {
    return videoUrl === null ? { kind: "unfollowable", list: unfollowable, videoUrl: null } : { kind: "video", videoUrl };
  }

  const playlistId = PlaylistId.parse(listId);
  return videoUrl === null ? { kind: "playlist", playlistId } : { kind: "videoInPlaylist", videoUrl, playlistId };
};

export const playlistUrl = (playlistId: PlaylistId): string => `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
