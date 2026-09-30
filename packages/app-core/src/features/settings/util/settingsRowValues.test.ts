import { describe, expect, it } from "vitest";
import { INITIAL_SYNC_STATUS } from "@overview/sync";
import { DEFAULT_API_KEYS } from "../../apiKeys/ApiKeys.js";
import { DEFAULT_SYNC_CONNECTION } from "../../sync/types/SyncConnection.js";
import {
  NOT_SIGNED_IN_ROW_VALUE,
  aboutRowValue,
  accountRowValue,
  keysRowValue,
  voiceRowValue,
} from "./settingsRowValues.js";

const NOW = new Date("2026-09-30T12:00:00Z");
const SYNCED = { ...INITIAL_SYNC_STATUS, lastSyncedAt: "2026-09-30T11:58:00Z" };
const SIGNED_IN = { ...DEFAULT_SYNC_CONNECTION, apiUrl: "https://sync.test", email: "ada@example.com" };

describe("accountRowValue", () => {
  it("names the reader by first name, then the sync status line", () => {
    expect(accountRowValue({ connected: true, status: SYNCED }, { ...SIGNED_IN, firstName: "Ada" }, NOW)).toBe(
      "Ada · Synced 2 minutes ago",
    );
  });

  it("falls back to the email when the account has no first name", () => {
    expect(accountRowValue({ connected: true, status: SYNCED }, SIGNED_IN, NOW)).toBe(
      "ada@example.com · Synced 2 minutes ago",
    );
  });

  it("is the status line alone when neither is known", () => {
    expect(accountRowValue({ connected: true, status: SYNCED }, DEFAULT_SYNC_CONNECTION, NOW)).toBe(
      "Synced 2 minutes ago",
    );
  });

  it("says a signed-out library stays where it is", () => {
    expect(accountRowValue({ connected: false, status: SYNCED }, DEFAULT_SYNC_CONNECTION, NOW)).toBe(
      NOT_SIGNED_IN_ROW_VALUE,
    );
  });
});

describe("voiceRowValue", () => {
  it("reads the voice's name and accent", () => {
    expect(voiceRowValue("bm_george")).toBe("George · British English");
  });
});

describe("keysRowValue", () => {
  it("says the Anthropic key is set, and names the model", () => {
    expect(keysRowValue({ ...DEFAULT_API_KEYS, anthropicApiKey: "sk-ant-test" }, "claude-sonnet-5")).toBe(
      "Anthropic key set · Claude Sonnet 5",
    );
  });

  it("says when there is no Anthropic key yet", () => {
    expect(keysRowValue(DEFAULT_API_KEYS, "claude-opus-5")).toBe("No Anthropic key yet · Claude Opus 5");
  });
});

describe("aboutRowValue", () => {
  it("is the version without the commit, which the section itself carries", () => {
    expect(aboutRowValue({ version: "0.14.2", commit: "30bb95a", dirty: true })).toBe("Version 0.14.2");
  });
});
