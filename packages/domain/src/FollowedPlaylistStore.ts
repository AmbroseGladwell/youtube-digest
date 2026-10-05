import type { PlaylistId, VideoId } from "./Brands.js";
import type { FollowedPlaylist } from "./FollowedPlaylist.js";

// What this device has already seen of a followed playlist, so a reordered playlist does not
// queue its old entries again. Never synced: each device checks for itself
// (docs/features/playlists.md, "New entries").
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
