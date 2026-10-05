import type { FollowedPlaylist, FollowedPlaylistStore, PlaylistCheck, PlaylistId } from "@overview/domain";

export class InMemoryFollowedPlaylistStore implements FollowedPlaylistStore {
  #followed = new Map<string, FollowedPlaylist>();
  #checks = new Map<string, PlaylistCheck>();

  seedFollowed(playlist: FollowedPlaylist): void {
    this.#followed.set(playlist.id, playlist);
  }

  seedCheck(check: PlaylistCheck): void {
    this.#checks.set(check.playlistId, check);
  }

  async listFollowed() {
    return [...this.#followed.values()];
  }

  async saveFollowed(playlist: FollowedPlaylist) {
    this.#followed.set(playlist.id, playlist);
  }

  async unfollow(playlistId: PlaylistId) {
    this.#followed.delete(playlistId);
    this.#checks.delete(playlistId);
  }

  async getCheck(playlistId: PlaylistId) {
    return this.#checks.get(playlistId) ?? null;
  }

  async saveCheck(check: PlaylistCheck) {
    this.#checks.set(check.playlistId, check);
  }
}
