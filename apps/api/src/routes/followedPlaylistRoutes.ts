import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PlaylistId } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { StoredRecordBody } from "../http/StoredRecordBody.js";
import { ifMatchOf, sendWritten } from "../http/writeHeaders.js";
import { decideReplace } from "../records/decideReplace.js";
import { decideTombstone } from "../records/decideTombstone.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";

const Params = z.object({ id: PlaylistId });

// A followed playlist is replaced whole, as an overview is: a device that checks it may
// learn it went private, and says so for every device (docs/features/playlists.md).
export function followedPlaylistRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.post("/followed-playlists", async (request, reply) => {
    const { schemaVersion, updatedAt, body } = parseOrThrow(StoredRecordBody, request.body, "The followed playlist");
    const id = parseOrThrow(PlaylistId, body.id, "The playlist's id");
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "followedPlaylist",
        id,
        decide: (current) =>
          decideReplace("followedPlaylist", current, { body, schemaVersion, updatedAt, ifMatch }, request.client!),
      },
    ]);
    return sendWritten(reply, written!, ifMatch === null ? 201 : 200);
  });

  app.delete("/followed-playlists/:id", async (request, reply) => {
    const { id } = parseOrThrow(Params, request.params, "The playlist's id");
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "followedPlaylist",
        id,
        decide: (current) => decideTombstone("followedPlaylist", current, ifMatch, request.client!),
      },
    ]);
    if (written === null || written === undefined) {
      request.log.info({ kind: "followedPlaylist", id }, "record already deleted");
      return reply.status(204).send();
    }
    return sendWritten(reply, written);
  });
}
