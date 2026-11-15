import test from "node:test";
import assert from "node:assert/strict";
import { listenMarkdown } from "./listenMarkdown.js";
import type { ListenPick } from "./ListenPick.js";

const pick = (overrides: Partial<ListenPick>): ListenPick => ({
  videoId: "a",
  title: "A talk",
  newWasA: true,
  side: "A",
  preferred: "new",
  reason: "",
  oldSeconds: 200,
  newSeconds: 200,
  pickedAt: "2026-11-13T12:00:00.000Z",
  ...overrides,
});

test("the report tallies the preferences and gives each pair's spoken lengths and reason", () => {
  const markdown = listenMarkdown(
    [
      pick({ title: "Hearing | part one", oldSeconds: 190, newSeconds: 545.6, reason: "Listed\nevery witness." }),
      pick({ videoId: "b", preferred: "old" }),
      pick({ videoId: "c", preferred: "new" }),
    ],
    "ov-228",
    "listen-old",
    "listen-new",
  );

  assert.match(markdown, /\*\*New 2, old 1, about the same 0\*\*, of 3 pairs/);
  assert.match(markdown, /\| Hearing \\\| part one \| 3:10 \| 9:06 \| new \| Listed every witness\. \|/);
  assert.match(markdown, /\| A talk \| 3:20 \| 3:20 \| old \| — \|/);
});
