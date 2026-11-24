import { describe, expect, it } from "vitest";
import { OverviewId, SourceKey, type KeptCapture } from "@overview/domain";
import { keptLinkDue } from "./keptLinkDue.js";

const kept = (overrides: Partial<KeptCapture> = {}): KeptCapture => ({
  id: OverviewId.parse("6c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f"),
  sourceKey: SourceKey.parse("keptVideo01"),
  url: "https://www.youtube.com/watch?v=keptVideo01",
  keptAt: "2026-11-24T20:00:00.000Z",
  keptFrom: "phone",
  captureReason: null,
  title: null,
  thumbnailUrl: null,
  fromPlaylist: null,
  addedAt: null,
  playlistIndex: null,
  chosenAt: null,
  stage: "kept",
  source: null,
  waitingFor: "server",
  resumesAt: "2026-11-25T01:00:00.000Z",
  queueStatus: "waiting",
  problem: null,
  ...overrides,
});

const at = (iso: string) => Date.parse(iso);

describe("keptLinkDue", () => {
  it("waits for our server until the time it gave, unless the extension can fetch it now", () => {
    const circumstances = { hasExtension: false, monthSpent: false };
    expect(keptLinkDue(kept(), { ...circumstances, now: at("2026-11-25T00:59:00.000Z") })).toBe(false);
    expect(keptLinkDue(kept(), { ...circumstances, now: at("2026-11-25T01:00:00.000Z") })).toBe(true);
    expect(keptLinkDue(kept(), { hasExtension: true, monthSpent: false, now: at("2026-11-24T21:00:00.000Z") })).toBe(true);
  });

  it("is made only where the extension is when only the extension can read it", () => {
    const link = kept({ waitingFor: "extension", resumesAt: null });
    expect(keptLinkDue(link, { now: 0, hasExtension: false, monthSpent: false })).toBe(false);
    expect(keptLinkDue(link, { now: 0, hasExtension: true, monthSpent: false })).toBe(true);
  });

  it("one that failed waits for the reader, not the clock", () => {
    expect(keptLinkDue(kept({ queueStatus: "failed", resumesAt: null }), { now: 0, hasExtension: true, monthSpent: false })).toBe(false);
  });
});
