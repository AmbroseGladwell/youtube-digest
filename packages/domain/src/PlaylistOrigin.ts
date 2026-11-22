import { z } from "zod";
import { PlaylistId } from "./Brands.js";

// On the overview, so it outlives unfollowing: docs/features/playlists.md, "The From line".
export const PlaylistOrigin = z.object({
  id: PlaylistId,
  title: z.string(),
});
export type PlaylistOrigin = z.infer<typeof PlaylistOrigin>;
