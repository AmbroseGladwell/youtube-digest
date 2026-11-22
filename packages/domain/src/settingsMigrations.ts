import { AboutYou, aboutYouIsEmpty, EMPTY_ABOUT_YOU } from "./AboutYou.js";
import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Before providers everything was Anthropic; the old model goes (docs/features/byo-providers.md).
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

// An empty sentence takes the old line again; a filled one is left alone (design 141).
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
