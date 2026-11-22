import {
  BACKING_RELATION,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_SOURCE_RELATION_LENGTH,
  type ChatAnswerSections,
  type ChatCitation,
  type ChatListItem,
} from "@overview/domain";
import type { ChatReply } from "./ChatReply.js";
import { outsideCode } from "./outsideCode.js";
import { withoutCitationMarks } from "./withoutCitationMarks.js";

type SourceRef = ChatReply["introSources"][number];

export const relationOf = (relation: string): string => {
  const said = relation.trim();
  if (said === "" || /^supports?\b/i.test(said)) {
    return BACKING_RELATION;
  }
  if (said.length <= MAX_SOURCE_RELATION_LENGTH) {
    return said;
  }
  const cut = said.slice(0, MAX_SOURCE_RELATION_LENGTH + 1);
  const atWord = cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.–—-]+$/, "");
  return atWord === "" ? said.slice(0, MAX_SOURCE_RELATION_LENGTH) : atWord;
};

export const withoutDashes = (text: string): string => text.replace(/\s*—\s*/g, ", ").replace(/,\s*,/g, ",");

// How a reply is stored and cited: docs/features/chats.md, "One shape for every answer".
export const structuredAnswer = (
  reply: Pick<ChatReply, "intro" | "introSources" | "sections" | "takeaway">,
  cite: (ids: readonly string[]) => ChatCitation[],
  { library = false }: { library?: boolean } = {},
): ChatAnswerSections => {
  const clean = (text: string) => outsideCode(text, (prose) => withoutDashes(withoutCitationMarks(prose, { library })));
  const sourcesOf = (refs: readonly SourceRef[]) => {
    const seen = new Set<string>();
    return refs.flatMap((ref) =>
      cite([ref.id]).flatMap((citation) => {
        const key = JSON.stringify(citation);
        if (seen.has(key)) {
          return [];
        }
        seen.add(key);
        return [{ citation, relation: relationOf(ref.relation) }];
      }),
    );
  };
  const itemsOf = (items: ChatReply["sections"][number]["numbered"]): ChatListItem[] =>
    items.flatMap((item) => {
      const text = clean(item.text);
      if (text === "") {
        return [];
      }
      const seen = new Set<string>();
      const sources = item.sources.flatMap((id) =>
        cite([id]).filter((citation) => {
          const key = JSON.stringify(citation);
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        }),
      );
      return [{ text, sources }];
    });
  return {
    intro: clean(reply.intro),
    introSources: sourcesOf(reply.introSources),
    sections: reply.sections.map((section) => ({
      heading: clean(section.heading),
      paragraphs: section.paragraphs.map(clean).filter((text) => text !== ""),
      numbered: itemsOf(section.numbered),
      bullets: itemsOf(section.bullets),
      sources: sourcesOf(section.sources),
    })),
    takeaway: clean(reply.takeaway),
  };
};

export const flattenedAnswer = (sections: ChatAnswerSections): string => {
  return [
    sections.intro,
    ...sections.sections.map((section) =>
      [
        section.heading,
        ...section.paragraphs,
        ...section.numbered.map((item, index) => `${index + 1}. ${item.text}`),
        ...section.bullets.map((item) => `- ${item.text}`),
      ].join("\n"),
    ),
    sections.takeaway,
  ]
    .filter((part) => part.trim() !== "")
    .join("\n\n")
    .slice(0, MAX_CHAT_MESSAGE_LENGTH);
};
