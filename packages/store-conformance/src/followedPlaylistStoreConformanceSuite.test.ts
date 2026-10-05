import type { FollowedPlaylist, FollowedPlaylistStore, PlaylistCheck, PlaylistId } from "@overview/domain";
import { defineFollowedPlaylistStoreConformanceSuite } from "./followedPlaylistStoreConformanceSuite.js";

class InMemoryFollowedPlaylistStore implements FollowedPlaylistStore {
  #followed = new Map<PlaylistId, FollowedPlaylist>();
  #checks = new Map<PlaylistId, PlaylistCheck>();

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

defineFollowedPlaylistStoreConformanceSuite("InMemoryFollowedPlaylistStore (reference)", () => new InMemoryFollowedPlaylistStore());
