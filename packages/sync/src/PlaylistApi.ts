import type { PlaylistId, PlaylistLookup } from "@overview/domain";

export interface PlaylistApi {
  lookup(playlistId: PlaylistId): Promise<PlaylistLookup>;
}
