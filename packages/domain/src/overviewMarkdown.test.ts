import test from "node:test";
import assert from "node:assert/strict";
import { OverviewId } from "./Brands.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { overviewMarkdown } from "./overviewMarkdown.js";

const SIMILAR_ID = OverviewId.parse("c4a9f0d2-7b31-4e68-8f5a-0d1c2b3a4e5f");

const FULL = makeOverview({
  video: {
    id: null,
    url: "https://www.youtube.com/watch?v=kQu7vN2wLpE",
    title: "The only kettlebell swing tutorial you need",
    channel: "Strength Practice",
    description: "Not part of the note.",
    durationMs: 754_000,
    publishedAt: "2025-11-02T12:00:00.000Z",
    thumbnailUrl: null,
  },
  savedAt: "2026-01-04T09:30:00.000Z",
  captureReason: "Watch again before the next session.",
  inOneLine: "A careful breakdown of the hip hinge.",
  coreClaim: "The swing is a hinge rather than a squat.",
  keyPoints: ["Throw the bell back.", "Stand tall at the top.", "Hinge, don't squat."],
  tags: ["kettlebell", "hip-hinge", "technique"],
  verdict: {
    novelty: "novel",
    dubious: true,
    reasoning: "The spinal claim is asserted rather than sourced.",
    similarTo: [{ overviewId: SIMILAR_ID, title: "Hinge before you load" }],
  },
  selling: { type: "own_paid_product", detail: "A paid programme is pitched twice.", compromisesContent: false },
  howToApply: { items: ["Film one set from the side."] },
  watchAnyway: {
    answer: "partial",
    reason: "The fault-finding section is worth seeing.",
    range: { startMs: 412_000, endMs: 658_000 },
  },
  chapters: [
    { title: "The hinge", summary: "Why the swing starts at the hips.", startMs: 0, endMs: 95_500 },
    { title: "Three faults", summary: "What goes wrong and how to see it.", startMs: 95_500, endMs: 754_000 },
  ],
});

test("writes every section of a full note in the reader's order", () => {
  const headings = overviewMarkdown(FULL)
    .split("\n")
    .filter((line) => line.startsWith("#"));

  assert.deepEqual(headings, [
    "# The only kettlebell swing tutorial you need",
    "## Why I saved it",
    "## Premise",
    "## Core claim",
    "## Verdict",
    "## Key points",
    "## How to apply",
    "## What it sells",
    "## Watch it anyway?",
    "## Chapters",
  ]);
});

test("opens with where the note came from: channel, length, dates, link and tags", () => {
  assert.ok(
    overviewMarkdown(FULL).startsWith(
      "# The only kettlebell swing tutorial you need\n\n" +
        "Strength Practice · 12:34 · published 2025-11-02 · saved 2026-01-04\n" +
        "https://www.youtube.com/watch?v=kQu7vN2wLpE\n\n" +
        "Tags: kettlebell, hip-hinge, technique\n",
    ),
  );
});

test("links every chapter to its moment in the video, so a point can be traced back", () => {
  const markdown = overviewMarkdown(FULL);

  assert.ok(markdown.includes("- [0:00](https://www.youtube.com/watch?v=kQu7vN2wLpE&t=0) **The hinge**: Why the swing starts at the hips."));
  assert.ok(markdown.includes("- [1:35](https://www.youtube.com/watch?v=kQu7vN2wLpE&t=95) **Three faults**"));
});

test("links the part worth watching to where it starts", () => {
  assert.ok(
    overviewMarkdown(FULL).includes(
      "Worth watching one part. The fault-finding section is worth seeing. [6:52–10:58](https://www.youtube.com/watch?v=kQu7vN2wLpE&t=412)",
    ),
  );
});

test("says when a verdict is dubious, and names the similar overviews by title and id", () => {
  const markdown = overviewMarkdown(FULL);

  assert.ok(markdown.includes("Novel, and dubious. The spinal claim is asserted rather than sourced."));
  assert.ok(markdown.includes(`Similar to: Hinge before you load (${SIMILAR_ID})`));
});

test("leaves out every optional section a sparse note does not have", () => {
  const markdown = overviewMarkdown(makeOverview({ thin: true, savedAt: "2026-01-04T09:30:00.000Z" }));

  const headings = markdown.split("\n").filter((line) => line.startsWith("#"));
  assert.deepEqual(headings, ["# Example", "## Premise", "## No clear claim", "## Key points"]);
  assert.ok(markdown.includes("Example Channel · saved 2026-01-04\n"));
});

test("leaves out selling when the video sells nothing", () => {
  const markdown = overviewMarkdown(
    makeOverview({ selling: { type: "none", detail: "", compromisesContent: false } }),
  );

  assert.ok(!markdown.includes("What it sells"));
});
