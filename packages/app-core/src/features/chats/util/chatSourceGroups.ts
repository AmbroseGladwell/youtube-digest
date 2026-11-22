import { relationLabel, type ChatAnswerSections, type ChatCitation } from "@overview/domain";

export const citationKey = (citation: ChatCitation): string => {
  if ("chatId" in citation) {
    return `c:${citation.chatId}`;
  }
  if ("overviewId" in citation) {
    return `o:${citation.overviewId}:${citation.item?.part ?? ""}:${citation.item?.index ?? ""}:${citation.range?.startMs ?? ""}`;
  }
  return "startMs" in citation ? `t:${citation.startMs}` : `p:${JSON.stringify(citation)}`;
};

export const byRelation = (sources: ChatAnswerSections["introSources"]) => {
  const groups = new Map<string, ChatCitation[]>();
  for (const { citation, relation } of sources) {
    const label = relationLabel(relation);
    const held = groups.get(label) ?? [];
    if (!held.some((each) => citationKey(each) === citationKey(citation))) {
      held.push(citation);
    }
    groups.set(label, held);
  }
  return [...groups.entries()];
};
