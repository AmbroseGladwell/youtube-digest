import { AboutYou, aboutYouIsEmpty, EMPTY_ABOUT_YOU } from "./AboutYou.js";
import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Derivable: a settings record written before there was more than one provider was,
// necessarily, an Anthropic one, and the model it names is the Anthropic model
// (docs/features/byo-providers.md). The old `model` is dropped rather than kept beside the
// new pair, because a client reading both would have two answers to one question.
const moveTheOneModelUnderItsProvider: RecordMigration = {
  newSchemaVersion: 2,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { model, ...rest } = record as Record<string, unknown>;
    return {
      ...rest,
      provider: "anthropic",
      modelByProvider: typeof model === "string" ? { anthropic: model } : {},
    };
  },
};

// Derivable: the old line becomes an entry the reader can see and edit (design 141, notes). A
// client from before the sentence can still write the line, so an empty sentence takes it
// again and one the reader has filled is left alone.
const moveTheLineIntoTheSentence: RecordMigration = {
  newSchemaVersion: 3,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    const { aboutYou, readerContext } = record as Record<string, unknown>;
    const parsed = AboutYou.safeParse(aboutYou);
    if (parsed.success && !aboutYouIsEmpty(parsed.data)) {
      return record;
    }
    const line = typeof readerContext === "string" ? readerContext.trim().replace(/\.$/, "") : "";
    return { ...record, aboutYou: { ...EMPTY_ABOUT_YOU, time: line === "" ? [] : [line] } };
  },
};

export const SETTINGS_MIGRATIONS: readonly RecordMigration[] = [moveTheOneModelUnderItsProvider, moveTheLineIntoTheSentence];

export const CURRENT_SETTINGS_SCHEMA_VERSION = currentSchemaVersion(SETTINGS_MIGRATIONS);
