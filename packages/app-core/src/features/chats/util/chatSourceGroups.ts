import { relationLabel, type ChatAnswerSections, type ChatCitation } from "@overview/domain";

// One key per place cited, so the same place is listed once.
export const citationKey = (citation: ChatCitation): string =>
  "chatId" in citation
    ? `c:${citation.chatId}`
    : "overviewId" in citation
      ? `o:${citation.overviewId}:${citation.item?.part ?? ""}:${citation.item?.index ?? ""}:${citation.range?.startMs ?? ""}`
      : "startMs" in citation
        ? `t:${citation.startMs}`
        : `p:${JSON.stringify(citation)}`;

// Each section's sources grouped by how they relate, in the order the relations first appear.
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
