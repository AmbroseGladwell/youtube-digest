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

export interface CitableOverview {
  overviewId: OtherOverviewCitation["overviewId"];
  title: string;
  overview: Overview;
  brief?: boolean;
}

const LABELLED_ID = /^([SO][1-9]\d*)(?:\.(.+))?$/;

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

// Why only the transcript makes an answer inSource: docs/features/chats.md, "Citing the overview".
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
