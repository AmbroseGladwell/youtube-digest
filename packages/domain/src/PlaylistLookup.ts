import { z } from "zod";
import { PlaylistId, VideoId } from "./Brands.js";
import { PlaylistPrivacy } from "./FollowedPlaylist.js";

// A private or deleted video stays listed with its title replaced (docs/features/playlists.md).
export const PlaylistEntryAvailability = z.enum(["available", "private", "deleted"]);
export type PlaylistEntryAvailability = z.infer<typeof PlaylistEntryAvailability>;

export const PlaylistEntry = z.object({
  videoId: VideoId,
  title: z.string(),
  channel: z.string().nullable(),
  thumbnailUrl: z.url().nullable(),
  // As YouTube reports it.
  addedAt: z.iso.datetime().nullable(),
  availability: PlaylistEntryAvailability,
});
export type PlaylistEntry = z.infer<typeof PlaylistEntry>;

// In the playlist's own order.
export const PlaylistLookup = z.object({
  id: PlaylistId,
  title: z.string(),
  owner: z.string().nullable(),
  privacy: PlaylistPrivacy,
  entries: z.array(PlaylistEntry),
});
export type PlaylistLookup = z.infer<typeof PlaylistLookup>;
