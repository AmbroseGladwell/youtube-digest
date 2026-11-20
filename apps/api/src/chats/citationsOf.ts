import {
  overviewPartHash,
  overviewPartId,
  overviewParts,
  type ChatCitation,
  type OtherOverviewCitation,
  type OverviewPartItem,
} from "@overview/domain";
import type { ChatReply } from "./ChatReply.js";
import type { LabelledSource } from "./otherSourcesInPrompt.js";
import type { Passage } from "./transcriptPassages.js";

export interface CitedAnswer {
  citations: ChatCitation[];
  inSource: boolean;
  sourceCitations: number;
  overviewCitations: number;
  chatCitations: number;
  otherOverviewCitations: number;
}

const SOURCE_ID = /^(S[1-9]\d*)(?:\.(.+))?$/;

// Another overview's id is its label, S2, or an item of it, S2.kp1. An overview listed in brief
// had no items shown, so only the overview itself is cited. An overview cited by an item isn't
// cited again on its own.
function otherOverviewCitationsOf(ids: readonly string[], sources: ReadonlyMap<string, LabelledSource>): OtherOverviewCitation[] {
  const cited: OtherOverviewCitation[] = [];
  for (const id of new Set(ids)) {
    const [, label, item] = SOURCE_ID.exec(id) ?? [];
    const entry = label === undefined ? undefined : sources.get(label);
    if (entry === undefined) continue;
    const { overviewId, title, brief } = entry.source;
    const found =
      item === undefined || brief === true
        ? undefined
        : overviewParts(entry.overview).find(({ part, index }) => overviewPartId(part, index) === item);
    if (item !== undefined && brief !== true && found === undefined) continue;
    cited.push({
      overviewId,
      title,
      item: found === undefined ? null : { part: found.part, index: found.index, textHash: overviewPartHash(found.text) },
    });
  }
  const byItem = new Set(cited.flatMap((citation) => (citation.item === null ? [] : [citation.overviewId])));
  return cited.filter(
    (citation, index) =>
      citation.item !== null ||
      (!byItem.has(citation.overviewId) && cited.findIndex((each) => each.overviewId === citation.overviewId) === index),
  );
}

// The model names passages, the overview's items, other chats' messages and other overviews by
// id; code turns them into times, places in the overview, message places and overviews, and drops
// any id it wasn't given.
// An answer is in the source only when it cites the transcript: the overview and another chat
// are never the source (docs/features/chats.md).
export function citationsOf(
  reply: ChatReply,
  passages: readonly Passage[],
  parts: readonly OverviewPartItem[],
  chatLabels: ReadonlyMap<string, Extract<ChatCitation, { chatId: string }>>,
  sources: ReadonlyMap<string, LabelledSource> = new Map(),
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
  const partIds = new Set(reply.overviewParts);
  const overview = parts
    .filter(({ part, index }) => partIds.has(overviewPartId(part, index)))
    .map(({ part, index, text }): ChatCitation => ({ part, index, textHash: overviewPartHash(text) }));
  const chats = [...new Set(reply.chatMessages)].flatMap((label) => {
    const citation = chatLabels.get(label);
    return citation === undefined ? [] : [citation];
  });
  const others = otherOverviewCitationsOf(reply.overviewParts, sources);
  return {
    citations: [...cited, ...overview, ...chats, ...others],
    inSource: cited.length > 0,
    sourceCitations: cited.length,
    overviewCitations: overview.length,
    chatCitations: chats.length,
    otherOverviewCitations: others.length,
  };
}
