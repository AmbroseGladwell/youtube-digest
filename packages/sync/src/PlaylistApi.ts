import type { PlaylistId, PlaylistLookup } from "@overview/domain";

// Reads a public or unlisted playlist through our server, which holds the YouTube key
// (docs/features/playlists.md, "Looking a playlist up").
export interface PlaylistApi {
  lookup(playlistId: PlaylistId): Promise<PlaylistLookup>;
}
