import type { RunRecord } from "./RunRecord.js";
import { makeGeneratedOutput } from "./GeneratedOutputFactory.testHelper.js";

export function makeRunRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    videoId: "video-one",
    provider: "anthropic",
    model: "claude-opus-5-5",
    startedAt: "2026-10-12T12:00:00.000Z",
    outcome: "passed-first",
    error: null,
    calls: [{ status: 200, latencyMs: 1000, usage: null }],
    latencyMs: 1000,
    costDollars: 0.05,
    attempts: [makeGeneratedOutput()],
    overview: null,
    ...overrides,
  };
}
