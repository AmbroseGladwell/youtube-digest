import type { FastifyBaseLogger } from "fastify";
import type { PlaylistId, PlaylistLookup, PlaylistUnavailable } from "@overview/domain";

export class PlaylistUnavailableError extends Error {
  readonly reason: PlaylistUnavailable;

  constructor(reason: PlaylistUnavailable) {
    super(reason === "private" ? "That playlist is private" : "There is no playlist with that id");
    this.reason = reason;
  }
}

// Reads a public or unlisted playlist whole. A private or missing one throws
// PlaylistUnavailableError (docs/features/playlists.md, "Looking a playlist up").
export interface PlaylistReader {
  read(playlistId: PlaylistId, log: FastifyBaseLogger): Promise<PlaylistLookup>;
}
