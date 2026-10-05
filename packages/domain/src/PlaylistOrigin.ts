import { z } from "zod";
import { PlaylistId } from "./Brands.js";

// The playlist an overview was made from, kept on the overview itself so it outlives
// unfollowing and syncs with the note (docs/features/playlists.md, "The From line").
export const PlaylistOrigin = z.object({
  id: PlaylistId,
  title: z.string(),
});
export type PlaylistOrigin = z.infer<typeof PlaylistOrigin>;
