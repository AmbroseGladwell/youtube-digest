import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettingsRecord, type LearnedItem, type Settings } from "@overview/domain";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { runProfilePassIfDue, type ProfilePassDeps } from "./runProfilePassIfDue.js";

const GONE: LearnedItem = {
  text: "saving for a home",
  source: "From 2 overviews",
  learnedAt: "2026-10-01T10:00:00.000Z",
  noticedAt: "2026-10-01T11:00:00.000Z",
  removedAt: "2026-10-02T10:00:00.000Z",
};

const harness = (count: number, seed: Partial<Settings> = {}, overrides: Partial<ProfilePassDeps> = {}) => {
  let settings: Settings = { ...DEFAULT_SETTINGS, ...seed };
  const profilePass = vi.fn(async () => ({ items: [{ text: "Building an app", source: "From 2 overviews on tech" }] }));
  const counted = { profilePassRan: vi.fn(), profilePassFailed: vi.fn() };
  const deps = {
    madeOn: "ours",
    own: null,
    api: { profilePass },
    overviewStore: {
      listOverviews: async () => Array.from({ length: count }, () => makeOverview()),
      listTopics: async () => [],
    },
    settingsStore: {
      get: async () => settings,
      update: async (patch: Partial<Settings>) => (settings = mergeSettingsRecord(settings, patch) as Settings),
    },
    analytics: { settings: { personalisation: counted } },
    now: () => new Date("2026-11-02T10:00:00.000Z"),
    ...overrides,
  } as unknown as ProfilePassDeps;
  return { deps, profilePass, counted, settings: () => settings };
};

describe("runProfilePassIfDue", () => {
  it("adds what it found, unseen by the notice so far, and remembers how far it got", async () => {
    const { deps, settings, counted } = harness(3);

    expect(await runProfilePassIfDue(deps)).toBe(true);

    expect(settings().learned).toEqual({
      "building an app": {
        text: "Building an app",
        source: "From 2 overviews on tech",
        learnedAt: "2026-11-02T10:00:00.000Z",
        noticedAt: null,
        removedAt: null,
      },
    });
    expect(settings().overviewsAtLastProfilePass).toBe(3);
    expect(counted.profilePassRan).toHaveBeenCalledWith({ added: 1, key: "ours" });
  });

  it("waits until three overviews have landed since the last pass", async () => {
    const { deps, profilePass } = harness(4, { overviewsAtLastProfilePass: 2 });

    expect(await runProfilePassIfDue(deps)).toBe(false);
    expect(profilePass).not.toHaveBeenCalled();
  });

  it("doesn't run with Keep learning off", async () => {
    const { deps, profilePass } = harness(9, { keepLearning: false });

    await runProfilePassIfDue(deps);

    expect(profilePass).not.toHaveBeenCalled();
  });

  it("doesn't run on a trial overview, which no account's pass can follow", async () => {
    const { deps, profilePass } = harness(3, {}, { api: null });

    expect(await runProfilePassIfDue(deps)).toBe(false);
    expect(profilePass).not.toHaveBeenCalled();
  });

  it("tells the pass what the reader removed", async () => {
    const { deps, profilePass } = harness(3, { learned: { "saving for a home": GONE } });

    await runProfilePassIfDue(deps);

    expect(profilePass).toHaveBeenCalledWith(expect.objectContaining({ removed: ["saving for a home"], learned: [] }));
  });

  it("counts a failure and tells nobody else, and leaves the schedule moved on", async () => {
    const profilePass = vi.fn(async () => {
      throw new Error("down");
    });
    const { deps, counted, settings } = harness(3, {}, { api: { profilePass } });

    expect(await runProfilePassIfDue(deps)).toBe(false);

    expect(counted.profilePassFailed).toHaveBeenCalledWith({ key: "ours" });
    expect(settings().overviewsAtLastProfilePass).toBe(3);
  });
});
