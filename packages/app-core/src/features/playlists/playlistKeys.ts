import type { PlaylistId } from "@overview/domain";

export const playlistKeys = {
  all: ["playlist"] as const,
  followed: () => [...playlistKeys.all, "followed"] as const,
  lookup: (apiUrl: string | null, playlistId: PlaylistId) => [...playlistKeys.all, "lookup", { apiUrl, playlistId }] as const,
  checks: () => [...playlistKeys.all, "checks"] as const,
};
