import {
  overviewPartHash,
  overviewPartId,
  overviewParts,
  type ChatCitation,
  type OtherOverviewCitation,
  type Overview,
  type OverviewPartItem,
} from "@overview/domain";
import type { CitedIds } from "./ChatReply.js";
import type { LabelledSource } from "./otherSourcesInPrompt.js";
import type { Passage } from "./transcriptPassages.js";

export interface CitedAnswer {
  citations: ChatCitation[];
  inSource: boolean;
  sourceCitations: number;
  overviewCitations: number;
  chatCitations: number;
  otherOverviewCitations: number;
  minuteCitations: number;
}

// An overview an answer may cite by its label: another overview in an overview's chat (S2), or one
// of a library's or project's (O3). One the model saw only in brief, without its items, can be
// cited only as a whole.
export interface CitableOverview {
  overviewId: OtherOverviewCitation["overviewId"];
  title: string;
  overview: Overview;
  brief?: boolean;
}

const LABELLED_ID = /^([SO][1-9]\d*)(?:\.(.+))?$/;

// Its label, or an item of it (S2.kp1, O3.step2). Unknown labels and items are dropped, and an
// overview cited by an item isn't cited again on its own.
export const overviewCitationsOf = (ids: readonly string[], labels: ReadonlyMap<string, CitableOverview>): OtherOverviewCitation[] => {
  const cited: OtherOverviewCitation[] = [];
  for (const id of new Set(ids)) {
    const [, label, item] = LABELLED_ID.exec(id) ?? [];
    const entry = label === undefined ? undefined : labels.get(label);
    if (entry === undefined) {
      continue;
    }
    const { overviewId, title, brief } = entry;
    const found =
      item === undefined || brief === true
        ? undefined
        : overviewParts(entry.overview).find(({ part, index }) => overviewPartId(part, index) === item);
    if (item !== undefined && brief !== true && found === undefined) {
      continue;
    }
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
};

const citable = (sources: ReadonlyMap<string, LabelledSource>): Map<string, CitableOverview> =>
  new Map(
    [...sources].map(([label, { source, overview }]) => [
      label,
      { overviewId: source.overviewId, title: source.title, overview, ...(source.brief === true ? { brief: true } : {}) },
    ]),
  );

// The model names passages, the overview's items, other chats' messages and other overviews by
// id; code turns them into times, places in the overview, message places and overviews, and drops
// any id it wasn't given.
// An answer is in the source only when it cites the transcript: the overview and another chat
// are never the source (docs/features/chats.md).
export const citationsOf = (
  reply: CitedIds,
  passages: readonly Passage[],
  parts: readonly OverviewPartItem[],
  chatLabels: ReadonlyMap<string, Extract<ChatCitation, { chatId: string }>>,
  sources: ReadonlyMap<string, LabelledSource> = new Map(),
  minuteLabels: ReadonlyMap<string, OtherOverviewCitation> = new Map(),
): CitedAnswer => {
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
  const others = overviewCitationsOf(
    reply.overviewParts.filter((id) => id.startsWith("S")),
    citable(sources),
  );
  // A minute of another overview's source it was shown, cited as a time of that source (OV-352).
  const minutes = [...new Set(reply.passages)].flatMap((id) => {
    const citation = minuteLabels.get(id);
    return citation === undefined ? [] : [citation];
  });
  return {
    citations: [...cited, ...overview, ...chats, ...others, ...minutes],
    inSource: cited.length > 0,
    sourceCitations: cited.length,
    overviewCitations: overview.length,
    chatCitations: chats.length,
    otherOverviewCitations: others.length + minutes.length,
    minuteCitations: minutes.length,
  };
};
