import { z } from "zod";

// The order a followed playlist's videos are made in (docs/features/playlists.md, "An order
// for each playlist").
export const PlaylistOrder = z.enum(["oldestFirst", "newestFirst", "playlistOrder"]);
export type PlaylistOrder = z.infer<typeof PlaylistOrder>;

export const DEFAULT_PLAYLIST_ORDER: PlaylistOrder = "oldestFirst";

export const PLAYLIST_ORDERS: readonly PlaylistOrder[] = PlaylistOrder.options;
