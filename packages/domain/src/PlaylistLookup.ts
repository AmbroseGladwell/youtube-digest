import { z } from "zod";
import { PlaylistId, VideoId } from "./Brands.js";
import { PlaylistPrivacy } from "./FollowedPlaylist.js";

// Whether YouTube will show a playlist's entry to anyone: a private or deleted video stays
// listed in the playlist with its title replaced (docs/features/playlists.md).
export const PlaylistEntryAvailability = z.enum(["available", "private", "deleted"]);
export type PlaylistEntryAvailability = z.infer<typeof PlaylistEntryAvailability>;

export const PlaylistEntry = z.object({
  videoId: VideoId,
  title: z.string(),
  channel: z.string().nullable(),
  thumbnailUrl: z.url().nullable(),
  // When it was added to the playlist, as YouTube reports it.
  addedAt: z.iso.datetime().nullable(),
  availability: PlaylistEntryAvailability,
});
export type PlaylistEntry = z.infer<typeof PlaylistEntry>;

// GET /api/playlists/:id: the playlist and every entry in it, in the playlist's own order.
export const PlaylistLookup = z.object({
  id: PlaylistId,
  title: z.string(),
  owner: z.string().nullable(),
  privacy: PlaylistPrivacy,
  entries: z.array(PlaylistEntry),
});
export type PlaylistLookup = z.infer<typeof PlaylistLookup>;
