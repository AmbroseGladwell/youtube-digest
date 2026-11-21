import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// 2: a citation of the overview's own items (OV-319), which a client before it can't read.
// 3: a citation of another of the reader's overviews (OV-355), likewise.
// 4: a chat owned by a project or by no one, the library, and sectioned answers (OV-353).
// 5: a citation of a minute of another overview's source (OV-352).
// 6: sectioned answers as paragraphs and lists with sources by how they relate, and Search my
//    library off (OV-354); an answer of points becomes bullets, each point's sources "Supports".
export const CHAT_MIGRATIONS: readonly RecordMigration[] = [
  { newSchemaVersion: 2 },
  { newSchemaVersion: 3 },
  { newSchemaVersion: 4 },
  { newSchemaVersion: 5 },
  { newSchemaVersion: 6, alterRecord: sectionsAsLists },
];

interface PointsSection {
  heading?: unknown;
  points?: Array<{ text?: unknown; citations?: unknown[] }>;
}

function sectionsAsLists(record: unknown): unknown {
  const chat = record as { messages?: Array<Record<string, unknown>> };
  if (!Array.isArray(chat.messages)) return record;
  return {
    ...chat,
    messages: chat.messages.map((message) => {
      const sections = message.sections as { sections?: PointsSection[] } | undefined;
      if (sections === undefined || !Array.isArray(sections.sections)) return message;
      return {
        ...message,
        sections: {
          ...sections,
          introSources: [],
          sections: sections.sections.map((section) => {
            if (!Array.isArray(section.points)) return section;
            const citations = section.points.flatMap((point) => point.citations ?? []);
            const unique = citations.filter(
              (citation, index) => citations.findIndex((each) => JSON.stringify(each) === JSON.stringify(citation)) === index,
            );
            return {
              heading: section.heading,
              paragraphs: [],
              numbered: [],
              bullets: section.points.map((point) => point.text),
              sources: unique.map((citation) => ({ citation, relation: "Supports" })),
            };
          }),
        },
      };
    }),
  };
}

export const CURRENT_CHAT_SCHEMA_VERSION = currentSchemaVersion(CHAT_MIGRATIONS);
