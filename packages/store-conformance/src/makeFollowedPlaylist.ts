import { PlaylistId, type FollowedPlaylist } from "@overview/domain";

export const makeFollowedPlaylist = (overrides: Partial<FollowedPlaylist> = {}): FollowedPlaylist => ({
  id: PlaylistId.parse("PLpsychology"),
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  followedAt: "2026-10-05T09:00:00.000Z",
  unavailable: null,
  ...overrides,
});
