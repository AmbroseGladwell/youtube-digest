import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  mergeSuggestedQuestion,
  OverviewId,
  ProjectId,
  SuggestedQuestionChange,
  SuggestedQuestionRefreshRequest,
  type SuggestedQuestionRefreshResponse,
  SUGGESTED_QUESTIONS_REFRESH_PATH,
} from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { sendWritten, UpdatedAt } from "../http/writeHeaders.js";
import { decideMerge } from "../records/decideMerge.js";
import type { SuggestedQuestionRefresher } from "../questions/SuggestedQuestionRefresher.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";

const QuestionParams = z.object({ first: OverviewId, second: OverviewId, question: z.uuid() });
const ProjectQuestionParams = QuestionParams.extend({ projectId: ProjectId });
const Stamped = z.object({ updatedAt: UpdatedAt }).loose();
const THE_QUESTION = "The question";
const THE_CHANGE = "The question change";

// The id's parts are the path, since a whole id is past Fastify's longest parameter.
export const suggestedQuestionRoutes = (
  app: FastifyInstance,
  records: RecordsRepository,
  refresher: SuggestedQuestionRefresher | null = null,
): void => {
  const changeQuestion = async (id: string, request: FastifyRequest, reply: FastifyReply) => {
    const { updatedAt, ...rest } = parseOrThrow(Stamped, request.body, THE_CHANGE);
    const change = parseOrThrow(SuggestedQuestionChange, rest, THE_CHANGE);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "suggestedQuestion",
        id,
        decide: (current) =>
          decideMerge(
            "suggestedQuestion",
            current,
            { patch: change, updatedAt, ifMatch: null, defaults: null, merge: mergeSuggestedQuestion },
            request.client!,
          ),
      },
    ]);
    return sendWritten(reply, written!);
  };

  // A device never makes a question or changes its words: docs/features/suggested-questions.md, "Who writes what".
  app.put("/suggested-questions/library/:first/:second/:question", async (request, reply) => {
    const { first, second, question } = parseOrThrow(QuestionParams, request.params, THE_QUESTION);
    return changeQuestion(`library:${first}:${second}:${question}`, request, reply);
  });

  app.put("/suggested-questions/project/:projectId/:first/:second/:question", async (request, reply) => {
    const { projectId, first, second, question } = parseOrThrow(ProjectQuestionParams, request.params, THE_QUESTION);
    return changeQuestion(`project:${projectId}:${first}:${second}:${question}`, request, reply);
  });

  // The page never waits for the writing: docs/features/suggested-questions.md, "Slice 2: the refresh".
  app.post(SUGGESTED_QUESTIONS_REFRESH_PATH, async (request, reply) => {
    const { scope } = parseOrThrow(SuggestedQuestionRefreshRequest, request.body, "The refresh");
    const answer = (body: SuggestedQuestionRefreshResponse) => reply.code(202).send(body);
    if (refresher === null) {
      return answer({ status: "unavailable" });
    }
    const { status } = await refresher.refresh(request.session!.accountId, scope, request.log);
    return answer({ status });
  });
};
