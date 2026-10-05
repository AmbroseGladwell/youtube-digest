import { z } from "zod";
import { PlaylistId } from "./Brands.js";

export const PlaylistPrivacy = z.enum(["public", "unlisted"]);
export type PlaylistPrivacy = z.infer<typeof PlaylistPrivacy>;

// Why a playlist that was followed can no longer be read: made private on YouTube, or
// gone from it altogether (docs/features/playlists.md).
export const PlaylistUnavailable = z.enum(["private", "gone"]);
export type PlaylistUnavailable = z.infer<typeof PlaylistUnavailable>;

// A playlist the reader follows, synced so every signed-in device follows the same ones.
// What each device has already seen of it is that device's own (docs/features/playlists.md).
export const FollowedPlaylist = z.object({
  id: PlaylistId,
  title: z.string(),
  owner: z.string().nullable(),
  privacy: PlaylistPrivacy,
  followedAt: z.iso.datetime(),
  unavailable: PlaylistUnavailable.nullable(),
});
export type FollowedPlaylist = z.infer<typeof FollowedPlaylist>;
