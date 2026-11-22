import type { ChatQuestion } from "./ChatQuestion.js";
import type { ChatReply } from "./chatTurn.js";
import { everyMomentCovered } from "./momentCovered.js";
import type { Passage } from "./transcriptPassages.js";

export interface ReplyScore {
  rightOnSource: boolean;
  citedRightMoment: boolean | null;
  mentioned: boolean | null;
  citedUnknownPassage: boolean;
}

export const scoreReply = (
  question: ChatQuestion,
  momentsMs: readonly number[],
  reply: ChatReply,
  passages: readonly Passage[],
): ReplyScore => {
  const byId = new Map(passages.map((passage) => [passage.id, passage]));
  const cited = reply.passages.flatMap((id) => byId.get(id.trim()) ?? []);
  const answerable = question.kind !== "notInSource";
  const answer = reply.answer.toLowerCase();
  return {
    rightOnSource: reply.inSource === answerable,
    citedRightMoment: answerable ? everyMomentCovered(cited, momentsMs) : null,
    mentioned: answerable && question.mentions.length > 0 ? question.mentions.some((term) => answer.includes(term.toLowerCase())) : null,
    citedUnknownPassage: cited.length < reply.passages.length,
  };
};
