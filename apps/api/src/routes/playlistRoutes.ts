import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PlaylistId } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { PlaylistUnavailableError, type PlaylistReader } from "../playlists/PlaylistReader.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";

const Params = z.object({ id: PlaylistId });

// Anyone may look a playlist up, signed in or not: following one is for everyone
// (docs/features/playlists.md). Without a YouTube key it says it is unavailable.
export function playlistRoutes(
  app: FastifyInstance,
  { reader, clock }: { reader: PlaylistReader | null; clock: () => Date },
): void {
  app.get(
    "/playlists/:id",
    {
      config: { public: true },
      preHandler: rateLimitHook(rateLimits.playlistPerAddress, (request) => request.clientAddress, clock),
    },
    async (request) => {
      const { id } = parseOrThrow(Params, request.params, "The playlist's id");
      if (reader === null) {
        throw new ApiError("unavailable", "This server does not read YouTube playlists");
      }
      try {
        return await reader.read(id, request.log);
      } catch (error) {
        if (error instanceof PlaylistUnavailableError) {
          request.log.info({ reason: error.reason }, "playlist unavailable");
          throw new ApiError(error.reason === "private" ? "playlist_private" : "playlist_not_found", error.message);
        }
        throw error;
      }
    },
  );
}
