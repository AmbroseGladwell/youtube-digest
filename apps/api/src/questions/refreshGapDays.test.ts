import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { SuggestedQuestion } from "@overview/domain";
import { BACKOFF_GAP_MAX_DAYS, lastEngagedAt, REFRESH_GAP_DAYS, refreshGapDays } from "./refreshGapDays.js";

const question = (overrides: Partial<SuggestedQuestion> = {}): SuggestedQuestion => ({
  id: randomUUID(),
  scope: { kind: "library" },
  overviewIds: [randomUUID(), randomUUID()] as never,
  text: "Does one survive the other?",
  madeAt: "2026-11-01T00:00:00.000Z",
  shownAt: "2026-11-01T01:00:00.000Z",
  askedAt: null,
  dismissedAt: null,
  feedback: null,
  ...overrides,
});

test("the gap stays at two days until two refreshes went untouched, then doubles up to its max", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(refreshGapDays), [
    REFRESH_GAP_DAYS,
    REFRESH_GAP_DAYS,
    4,
    8,
    BACKOFF_GAP_MAX_DAYS,
    BACKOFF_GAP_MAX_DAYS,
  ]);
});

test("asking, Good question, Not useful and Hide all count as engaging, and being shown doesn't", () => {
  assert.equal(lastEngagedAt([question()]), null);
  assert.equal(
    lastEngagedAt([
      question({ askedAt: "2026-11-02T00:00:00.000Z" }),
      question({ feedback: { verdict: "glad", at: "2026-11-05T00:00:00.000Z" } }),
      question({ feedback: { verdict: "obvious", at: "2026-11-03T00:00:00.000Z" } }),
      question({ dismissedAt: "2026-11-04T00:00:00.000Z" }),
    ]),
    "2026-11-05T00:00:00.000Z",
  );
});
