import { z } from "zod";
import { PlaylistId } from "./Brands.js";
import { PlaylistOrder } from "./PlaylistOrder.js";
import { PlaylistPace } from "./PlaylistPace.js";

export const PlaylistPrivacy = z.enum(["public", "unlisted"]);
export type PlaylistPrivacy = z.infer<typeof PlaylistPrivacy>;

export const PlaylistUnavailable = z.enum(["private", "gone"]);
export type PlaylistUnavailable = z.infer<typeof PlaylistUnavailable>;

// Synced; what each device has seen of it is its own (docs/features/playlists.md).
export const FollowedPlaylist = z.object({
  id: PlaylistId,
  title: z.string(),
  owner: z.string().nullable(),
  privacy: PlaylistPrivacy,
  followedAt: z.iso.datetime(),
  unavailable: PlaylistUnavailable.nullable(),
  pace: PlaylistPace,
  order: PlaylistOrder,
});
export type FollowedPlaylist = z.infer<typeof FollowedPlaylist>;
