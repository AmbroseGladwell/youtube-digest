import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { mergeSuggestedQuestion, OverviewId, ProjectId, SuggestedQuestionChange } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { sendWritten, UpdatedAt } from "../http/writeHeaders.js";
import { decideMerge } from "../records/decideMerge.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";

const QuestionParams = z.object({ first: OverviewId, second: OverviewId, question: z.uuid() });
const ProjectQuestionParams = QuestionParams.extend({ projectId: ProjectId });
const Stamped = z.object({ updatedAt: UpdatedAt }).loose();
const THE_QUESTION = "The question";
const THE_CHANGE = "The question change";

// The id's parts are the path, since a whole id is past Fastify's longest parameter.
export const suggestedQuestionRoutes = (app: FastifyInstance, records: RecordsRepository): void => {
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
};
