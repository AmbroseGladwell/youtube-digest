import { describe, expect, it } from "vitest";
import { INITIAL_SYNC_STATUS } from "@overview/sync";
import { DEFAULT_SECTIONS_ENABLED, type Provider } from "@overview/domain";
import { DEFAULT_API_KEYS } from "../../apiKeys/ApiKeys.js";
import { DEFAULT_SYNC_CONNECTION } from "../../sync/types/SyncConnection.js";
import {
  NOT_SIGNED_IN_ROW_VALUE,
  aboutRowValue,
  accountRowValue,
  keysRowValue,
  milestonesRowValue,
  personalisationRowValue,
  voiceRowValue,
} from "./settingsRowValues.js";

const NOW = new Date("2026-09-30T12:00:00Z");
const SYNCED = { ...INITIAL_SYNC_STATUS, lastSyncedAt: "2026-09-30T11:58:00Z" };
const NEVER_SIGNED_OUT = { signedOutHere: false, surface: "web" as const };
const SIGNED_IN = { ...DEFAULT_SYNC_CONNECTION, apiUrl: "https://sync.test", email: "ada@example.com" };

describe("accountRowValue", () => {
  it("names the reader by first name, then the sync status line", () => {
    expect(accountRowValue({ connected: true, status: SYNCED }, { ...SIGNED_IN, firstName: "Ada" }, NOW, NEVER_SIGNED_OUT)).toBe(
      "Ada · Synced 2 minutes ago",
    );
  });

  it("falls back to the email when the account has no first name", () => {
    expect(accountRowValue({ connected: true, status: SYNCED }, SIGNED_IN, NOW, NEVER_SIGNED_OUT)).toBe(
      "ada@example.com · Synced 2 minutes ago",
    );
  });

  it("is the status line alone when neither is known", () => {
    expect(accountRowValue({ connected: true, status: SYNCED }, DEFAULT_SYNC_CONNECTION, NOW, NEVER_SIGNED_OUT)).toBe(
      "Synced 2 minutes ago",
    );
  });

  it("says where the library is saved once this device has signed out of an account (47g)", () => {
    expect(
      accountRowValue({ connected: false, status: SYNCED }, DEFAULT_SYNC_CONNECTION, NOW, {
        signedOutHere: true,
        surface: "web",
      }),
    ).toBe("Signed out · saved in this browser");
    expect(
      accountRowValue({ connected: false, status: SYNCED }, DEFAULT_SYNC_CONNECTION, NOW, {
        signedOutHere: true,
        surface: "extension",
      }),
    ).toBe("Signed out · saved in the extension");
  });

  it("says a signed-out library stays where it is", () => {
    expect(accountRowValue({ connected: false, status: SYNCED }, DEFAULT_SYNC_CONNECTION, NOW, NEVER_SIGNED_OUT)).toBe(
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
  const withKeys = (...providers: Provider[]) => ({
    keys: Object.fromEntries(providers.map((provider) => [provider, { key: "sk-test", addedAt: null }])),
  });

  it("says when no key has been saved on this device", () => {
    expect(keysRowValue(DEFAULT_API_KEYS, "anthropic", {})).toBe("No keys yet");
  });

  it("names the model and says this device holds one key", () => {
    expect(keysRowValue(withKeys("anthropic"), "anthropic", { anthropic: "claude-sonnet-5-5" })).toBe(
      "Claude Sonnet 5.5 · 1 key",
    );
  });

  it("counts the keys when there are several", () => {
    expect(
      keysRowValue(withKeys("anthropic", "openai", "gemini"), "gemini", { gemini: "gemini-3.6" }),
    ).toBe("Gemini 3.6 · 3 keys");
  });

  it("says in words when the choice arrived by sync and the key did not, because a count cannot", () => {
    expect(keysRowValue(withKeys("anthropic"), "gemini", { gemini: "gemini-3.6" })).toBe(
      "Gemini 3.6 · no Gemini key here",
    );
  });

  it("falls back to the model we would have picked when the reader has never chosen one", () => {
    expect(keysRowValue(withKeys("openai"), "openai", {})).toBe("GPT-6.1 Sol · 1 key");
  });

  it("shows a model id we have never heard of as the provider lists it", () => {
    expect(keysRowValue(withKeys("openai"), "openai", { openai: "gpt-9-unreleased" })).toBe(
      "gpt-9-unreleased · 1 key",
    );
  });
});

describe("aboutRowValue", () => {
  it("is the version without the commit, which the section itself carries", () => {
    expect(aboutRowValue({ version: "0.14.2", commit: "30bb95a", dirty: true })).toBe("Version 0.14.2");
  });
});

describe("milestonesRowValue", () => {
  it("is the total saved and how many of the ten milestones it reaches", () => {
    expect(milestonesRowValue(9 * 60 + 47)).toBe("9h 47m saved · 3 of 10");
    expect(milestonesRowValue(0)).toBe("0m saved · 0 of 10");
  });
});

describe("personalisationRowValue", () => {
  it("says how many of the four optional sections the next overview will have", () => {
    expect(personalisationRowValue(DEFAULT_SECTIONS_ENABLED)).toBe("Every section");
    expect(personalisationRowValue({ ...DEFAULT_SECTIONS_ENABLED, selling: false })).toBe("3 of 4 sections");
    expect(
      personalisationRowValue({ verdict: false, selling: false, howToApply: false, watchAnyway: false }),
    ).toBe("Summary and key points only");
  });
});
