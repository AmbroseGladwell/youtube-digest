import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, chatRecordId, OverviewId } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { sendWritten } from "../http/writeHeaders.js";
import { decideTombstone } from "../records/decideTombstone.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";

const Params = z.object({ overviewId: OverviewId, conversationId: z.uuid() });

// The reader deletes a conversation. Nothing else a device sends changes one: the server
// writes them (docs/features/chats.md).
export function chatRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.delete("/chats/:overviewId/:conversationId", async (request, reply) => {
    const { overviewId, conversationId } = parseOrThrow(Params, request.params, "The conversation");
    const id = chatRecordId(overviewId, conversationId);
    const [written] = await records.write(request.session!.accountId, [
      { kind: "chat", id, decide: (current) => decideTombstone("chat", current, null, request.client!) },
    ]);
    if (written === null || written === undefined) {
      request.log.info(apiLogLines.sync.recordAlreadyDeleted({ kind: "chat", id }));
      return reply.status(204).send();
    }
    return sendWritten(reply, written);
  });
}
