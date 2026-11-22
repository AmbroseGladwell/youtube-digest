import { z } from "zod";

// docs/features/playlists.md, "An order for each playlist".
export const PlaylistOrder = z.enum(["oldestFirst", "newestFirst", "playlistOrder"]);
export type PlaylistOrder = z.infer<typeof PlaylistOrder>;

export const DEFAULT_PLAYLIST_ORDER: PlaylistOrder = "oldestFirst";

export const PLAYLIST_ORDERS: readonly PlaylistOrder[] = PlaylistOrder.options;
