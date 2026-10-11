import test from "node:test";
import assert from "node:assert/strict";
import { migrateRecord } from "./migrateRecord.js";
import { SETTINGS_MIGRATIONS } from "./settingsMigrations.js";
import { Settings, DEFAULT_SETTINGS } from "./Settings.js";

const settingsBeforeProviders = {
  sectionsEnabled: { verdict: true, selling: true, howToApply: true, watchAnyway: true },
  readerContext: null,
  model: "claude-opus-5",
  plan: "free",
  plusNoticeDismissed: false,
  narrationVoice: "af_heart",
  milestones: {},
  showMilestoneCards: true,
  analyticsOptOut: false,
  analyticsOptOutChangedAt: null,
  tagAliases: {},
};

const migrate = (record: unknown) => migrateRecord(record, SETTINGS_MIGRATIONS);

test("a record written before there was more than one provider becomes an Anthropic one", () => {
  const migrated = migrate(settingsBeforeProviders) as Record<string, unknown>;

  assert.equal(migrated.provider, "anthropic");
  assert.deepEqual(migrated.modelByProvider, { anthropic: "claude-opus-5" });
});

test("the old single model is dropped, so no client can read two answers to one question", () => {
  assert.equal("model" in (migrate(settingsBeforeProviders) as Record<string, unknown>), false);
});

test("the rest of the record is carried through untouched", () => {
  const migrated = migrate({ ...settingsBeforeProviders, readerContext: "a parent" }) as Record<string, unknown>;

  assert.equal(migrated.readerContext, "a parent");
  assert.equal(migrated.narrationVoice, "af_heart");
});

test("a migrated record parses, which is what the read boundary does next", () => {
  const parsed = Settings.parse(migrate(settingsBeforeProviders));

  assert.equal(parsed.provider, "anthropic");
  assert.equal(parsed.modelByProvider.anthropic, "claude-opus-5");
});

test("a record with no model at all still names a provider rather than arriving without one", () => {
  const { model: _, ...noModel } = settingsBeforeProviders;

  const migrated = migrate(noModel) as Record<string, unknown>;

  assert.equal(migrated.provider, "anthropic");
  assert.deepEqual(migrated.modelByProvider, {});
});

test("the default settings generate with Anthropic and have chosen no model for anyone", () => {
  assert.equal(DEFAULT_SETTINGS.provider, "anthropic");
  assert.deepEqual(DEFAULT_SETTINGS.modelByProvider, {});
});

test("a provider this client does not know reads as the default rather than taking the settings with it", () => {
  const read = Settings.parse({ ...DEFAULT_SETTINGS, readerContext: "a parent", provider: "some-new-provider" });

  assert.equal(read.provider, "anthropic");
  assert.equal(read.readerContext, "a parent");
});

test("a model id this client has never heard of is kept, because the reader's key can reach it", () => {
  const read = Settings.parse({ ...DEFAULT_SETTINGS, modelByProvider: { openai: "gpt-7-unreleased" } });

  assert.equal(read.modelByProvider.openai, "gpt-7-unreleased");
});
