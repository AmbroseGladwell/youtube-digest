import type { PlaylistId, VideoId } from "./Brands.js";
import type { FollowedPlaylist } from "./FollowedPlaylist.js";

// Never synced, so each device checks for itself: docs/features/playlists.md, "New entries".
export interface PlaylistCheck {
  playlistId: PlaylistId;
  seenVideoIds: VideoId[];
  checkedAt: string;
}

export interface FollowedPlaylistStore {
  listFollowed(): Promise<FollowedPlaylist[]>;
  saveFollowed(playlist: FollowedPlaylist): Promise<void>;
  unfollow(playlistId: PlaylistId): Promise<void>;
  getCheck(playlistId: PlaylistId): Promise<PlaylistCheck | null>;
  saveCheck(check: PlaylistCheck): Promise<void>;
}
