import { Readable } from "node:stream";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  chatConversationId,
  chatOwnerOfId,
  chatRecordId,
  ChatQuestionRequest,
  FIRST_ACROSS_SOURCES_CLIENT_VERSION,
  OverviewId,
  ProjectId,
  type ChatStreamEvent,
} from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { ChatAnswerer } from "../chats/ChatAnswerer.js";
import type { LibraryChatAnswerer, LibraryChatOwner } from "../chats/LibraryChatAnswerer.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError, isApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { bindLogContext } from "../logs/bindLogContext.js";
import { sendWritten } from "../http/writeHeaders.js";
import { decideTombstone } from "../records/decideTombstone.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { ChatUsageRepository } from "../usage/ChatUsageRepository.js";

const Params = z.object({ overviewId: OverviewId, conversationId: z.uuid() });
// Any chat by its whole id, whatever owns it: an overview, a project or the library (OV-353).
const RecordParams = z.object({
  id: z.string().refine((id) => chatOwnerOfId(id) !== null && z.uuid().safeParse(chatConversationId(id)).success, "not a chat's id"),
});
const OverviewParams = z.object({ overviewId: OverviewId });
const ProjectParams = z.object({ projectId: ProjectId });
const LibraryQuestion = ChatQuestionRequest.pick({ conversationId: true, text: true });

async function* serverSentEvents(events: AsyncIterable<ChatStreamEvent>): AsyncGenerator<string> {
  for await (const event of events) yield `data: ${JSON.stringify(event)}\n\n`;
}

// The reader asks, and the answer streams back as server-sent events; the server writes the
// conversation, and the reader can only delete one (docs/features/chats.md).
export function chatRoutes(
  app: FastifyInstance,
  {
    records,
    answerer,
    libraryAnswerer,
    usage,
    sql,
    clock,
  }: {
    records: RecordsRepository;
    answerer: ChatAnswerer | null;
    libraryAnswerer: LibraryChatAnswerer | null;
    usage: ChatUsageRepository;
    sql: SqlClient;
    clock: () => Date;
  },
): void {
  const streamed = async (reply: FastifyReply, start: () => Promise<AsyncIterable<ChatStreamEvent>>) => {
    try {
      const events = await start();
      return reply
        .header("content-type", "text/event-stream; charset=utf-8")
        .header("cache-control", "no-store")
        .send(Readable.from(serverSentEvents(events)));
    } catch (error) {
      const retryAfter = isApiError(error) ? error.details?.retryAfterSeconds : undefined;
      if (typeof retryAfter === "number") reply.header("retry-after", String(retryAfter));
      throw error;
    }
  };

  // A chat over the whole library, or on a project's page: answered in sections (OV-353).
  const askOver = async (owner: LibraryChatOwner, request: FastifyRequest, reply: FastifyReply) => {
    const question = parseOrThrow(LibraryQuestion, request.body, "The question");
    if (libraryAnswerer === null) throw new ApiError("unavailable", "This server doesn't answer questions on its own key");
    const { accountId } = request.session!;
    return streamed(reply, async () =>
      libraryAnswerer.ask({ accountId, plan: await accountPlan(sql, accountId) }, owner, question, request.log),
    );
  };
  app.post("/chats/library/messages", (request, reply) => askOver({ kind: "library" }, request, reply));
  app.post("/chats/projects/:projectId/messages", (request, reply) => {
    const { projectId } = parseOrThrow(ProjectParams, request.params, "The project");
    return askOver({ kind: "project", id: projectId }, request, reply);
  });

  app.post("/chats/:overviewId/messages", async (request, reply) => {
    const { overviewId } = parseOrThrow(OverviewParams, request.params, "The overview");
    bindLogContext(request, reply, { overviewId });
    const question = parseOrThrow(ChatQuestionRequest, request.body, "The question");
    if (answerer === null) throw new ApiError("unavailable", "This server doesn't answer questions on its own key");
    const { accountId } = request.session!;
    return streamed(reply, async () =>
      answerer.ask(
        {
          accountId,
          plan: await accountPlan(sql, accountId),
          acrossSources: request.client!.version >= FIRST_ACROSS_SOURCES_CLIENT_VERSION,
        },
        overviewId,
        question,
        request.log,
      ),
    );
  });

  app.get("/chat-usage", async (request) => {
    const { accountId } = request.session!;
    return usage.usage(clock(), accountId, await accountPlan(sql, accountId));
  });

  const deleteChat = async (id: string, request: FastifyRequest, reply: FastifyReply) => {
    const [written] = await records.write(request.session!.accountId, [
      { kind: "chat", id, decide: (current) => decideTombstone("chat", current, null, request.client!) },
    ]);
    if (written === null || written === undefined) {
      request.log.info(apiLogLines.sync.recordAlreadyDeleted({ kind: "chat", id }));
      return reply.status(204).send();
    }
    return sendWritten(reply, written);
  };

  // Clients up to 25 delete an overview's chat by its parts.
  app.delete("/chats/:overviewId/:conversationId", async (request, reply) => {
    const { overviewId, conversationId } = parseOrThrow(Params, request.params, "The conversation");
    bindLogContext(request, reply, { overviewId });
    return deleteChat(chatRecordId(overviewId, conversationId), request, reply);
  });

  app.delete("/chat-records/:id", async (request, reply) => {
    const { id } = parseOrThrow(RecordParams, request.params, "The conversation");
    const owner = chatOwnerOfId(id);
    if (owner?.kind === "overview") bindLogContext(request, reply, { overviewId: owner.id });
    return deleteChat(id, request, reply);
  });
}
