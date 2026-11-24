import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

const itemOf = (item: unknown) => (typeof item === "string" ? { text: item, sources: [] } : item);

const listItemsWithSources = (record: unknown): unknown => {
  const chat = record as { messages?: Array<Record<string, unknown>> };
  if (!Array.isArray(chat.messages)) {
    return record;
  }
  return {
    ...chat,
    messages: chat.messages.map((message) => {
      const sections = message.sections as { sections?: Array<{ numbered?: unknown[]; bullets?: unknown[] }> } | undefined;
      if (sections === undefined || !Array.isArray(sections.sections)) {
        return message;
      }
      return {
        ...message,
        sections: {
          ...sections,
          sections: sections.sections.map((section) => ({
            ...section,
            numbered: (section.numbered ?? []).map(itemOf),
            bullets: (section.bullets ?? []).map(itemOf),
          })),
        },
      };
    }),
  };
};

interface PointsSection {
  heading?: unknown;
  points?: Array<{ text?: unknown; citations?: unknown[] }>;
}

const uniqueByValue = (values: unknown[]) =>
  values.filter((value, index) => values.findIndex((each) => JSON.stringify(each) === JSON.stringify(value)) === index);

const pointsAsList = (section: PointsSection) => {
  if (!Array.isArray(section.points)) {
    return section;
  }
  const citations = uniqueByValue(section.points.flatMap((point) => point.citations ?? []));
  return {
    heading: section.heading,
    paragraphs: [],
    numbered: [],
    bullets: section.points.map((point) => point.text),
    sources: citations.map((citation) => ({ citation, relation: "Supports" })),
  };
};

const sectionsAsLists = (record: unknown): unknown => {
  const chat = record as { messages?: Array<Record<string, unknown>> };
  if (!Array.isArray(chat.messages)) {
    return record;
  }
  return {
    ...chat,
    messages: chat.messages.map((message) => {
      const sections = message.sections as { sections?: PointsSection[] } | undefined;
      if (sections === undefined || !Array.isArray(sections.sections)) {
        return message;
      }
      return {
        ...message,
        sections: {
          ...sections,
          introSources: [],
          sections: sections.sections.map(pointsAsList),
        },
      };
    }),
  };
};

const allowOverviewItemCitations: RecordMigration = { newSchemaVersion: 2 };
const allowOtherOverviewCitations: RecordMigration = { newSchemaVersion: 3 };
const allowProjectAndLibraryChatsWithSections: RecordMigration = { newSchemaVersion: 4 };
const allowSourceMinuteCitations: RecordMigration = { newSchemaVersion: 5 };
const turnPointsIntoParagraphsAndLists: RecordMigration = { newSchemaVersion: 6, alterRecord: sectionsAsLists };
const giveListItemsTheirOwnSources: RecordMigration = { newSchemaVersion: 7, alterRecord: listItemsWithSources };
const allowTopicPinnedSources: RecordMigration = { newSchemaVersion: 8 };

export const CHAT_MIGRATIONS: readonly RecordMigration[] = [
  allowOverviewItemCitations,
  allowOtherOverviewCitations,
  allowProjectAndLibraryChatsWithSections,
  allowSourceMinuteCitations,
  turnPointsIntoParagraphsAndLists,
  giveListItemsTheirOwnSources,
  allowTopicPinnedSources,
];

export const CURRENT_CHAT_SCHEMA_VERSION = currentSchemaVersion(CHAT_MIGRATIONS);
