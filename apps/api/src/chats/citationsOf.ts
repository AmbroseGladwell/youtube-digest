import type { ChatCitation } from "@overview/domain";
import type { ChatReply } from "./ChatReply.js";
import type { Passage } from "./transcriptPassages.js";

export interface CitedAnswer {
  citations: ChatCitation[];
  inSource: boolean;
  sourceCitations: number;
  chatCitations: number;
}

// The model names passages and other chats' messages by id; code turns them into times and
// message places, and drops any id it wasn't given. An answer is in the source only when it
// cites the transcript: another chat is never the source (docs/features/chats.md).
export function citationsOf(
  reply: ChatReply,
  passages: readonly Passage[],
  chatLabels: ReadonlyMap<string, Extract<ChatCitation, { chatId: string }>>,
): CitedAnswer {
  const byId = new Map(passages.map((passage) => [passage.id, passage]));
  const cited = reply.inSource
    ? [...new Set(reply.passages)]
        .flatMap((id) => {
          const passage = byId.get(id);
          return passage === undefined ? [] : [passage];
        })
        .sort((left, right) => left.startMs - right.startMs)
        .map(({ startMs, endMs }): ChatCitation => ({ startMs, endMs }))
    : [];
  const chats = [...new Set(reply.chatMessages)].flatMap((label) => {
    const citation = chatLabels.get(label);
    return citation === undefined ? [] : [citation];
  });
  return { citations: [...cited, ...chats], inSource: cited.length > 0, sourceCitations: cited.length, chatCitations: chats.length };
}
