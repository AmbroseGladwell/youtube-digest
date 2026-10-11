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

export const SETTINGS_MIGRATIONS: readonly RecordMigration[] = [moveTheOneModelUnderItsProvider];

export const CURRENT_SETTINGS_SCHEMA_VERSION = currentSchemaVersion(SETTINGS_MIGRATIONS);
