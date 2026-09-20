import { describe, expect, it } from "vitest";
import type { TranscriptSource } from "../types/TranscriptSource.js";
import { freeTranscriptSources } from "./freeTranscriptSources.js";

const source = (tier: TranscriptSource["tier"], cost: TranscriptSource["cost"]): TranscriptSource => ({
  tier,
  cost,
  isReady: () => Promise.resolve(true),
  resolve: () => Promise.resolve(null),
});

describe("freeTranscriptSources", () => {
  it("keeps the rungs that cost nothing, in the order the ladder asks them", () => {
    const kept = freeTranscriptSources([
      source("shared-cache", "free"),
      source("extension", "free"),
      source("supadata", "metered"),
    ]);

    expect(kept.map((rung) => rung.tier)).toEqual(["shared-cache", "extension"]);
  });

  it("leaves nothing to ask when every rung would spend, rather than picking the cheapest", () => {
    expect(freeTranscriptSources([source("supadata", "metered")])).toEqual([]);
  });
});
