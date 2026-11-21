import { MAX_CHAT_MESSAGE_LENGTH, MAX_SOURCE_RELATION_LENGTH, type ChatAnswerSections, type ChatCitation } from "@overview/domain";
import type { ChatReply } from "./ChatReply.js";
import { withoutCitationMarks } from "./withoutCitationMarks.js";

type SourceRef = ChatReply["introSources"][number];

// How a source relates, as the model put it in a few words: "Supports" when it said nothing.
const relationOf = (relation: string): string => relation.trim().slice(0, MAX_SOURCE_RELATION_LENGTH) || "Supports";

// The reply as it is stored and shown, the same for every chat (OV-354): text without any ids the
// model wrote into it, and each source cited by code, an id it wasn't given dropped. A source citing
// two places, such as an overview's item and its minute, gives one chip for each.
export function structuredAnswer(
  reply: Pick<ChatReply, "intro" | "introSources" | "sections" | "takeaway">,
  cite: (ids: readonly string[]) => ChatCitation[],
  { library = false }: { library?: boolean } = {},
): ChatAnswerSections {
  const clean = (text: string) => withoutCitationMarks(text, { library });
  const sourcesOf = (refs: readonly SourceRef[]) => {
    const seen = new Set<string>();
    return refs.flatMap((ref) =>
      cite([ref.id]).flatMap((citation) => {
        const key = JSON.stringify(citation);
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ citation, relation: relationOf(ref.relation) }];
      }),
    );
  };
  return {
    intro: clean(reply.intro),
    introSources: sourcesOf(reply.introSources),
    sections: reply.sections.map((section) => ({
      heading: clean(section.heading),
      paragraphs: section.paragraphs.map(clean).filter((text) => text !== ""),
      numbered: section.numbered.map(clean).filter((text) => text !== ""),
      bullets: section.bullets.map(clean).filter((text) => text !== ""),
      sources: sourcesOf(section.sources),
    })),
    takeaway: clean(reply.takeaway),
  };
}

// The answer as one text: what copy, a hand-off and the next question's history read.
export function flattenedAnswer(sections: ChatAnswerSections): string {
  return [
    sections.intro,
    ...sections.sections.map((section) =>
      [
        section.heading,
        ...section.paragraphs,
        ...section.numbered.map((item, index) => `${index + 1}. ${item}`),
        ...section.bullets.map((item) => `- ${item}`),
      ].join("\n"),
    ),
    sections.takeaway,
  ]
    .filter((part) => part.trim() !== "")
    .join("\n\n")
    .slice(0, MAX_CHAT_MESSAGE_LENGTH);
}
