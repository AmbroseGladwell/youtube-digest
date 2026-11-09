import { z } from "zod";
import { formatTimestamp, type Overview } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import { transcriptForJudging } from "./judgeRubric.js";

// Raise when the rubric changes, so judgments under the old wording are kept apart, not reused.
export const KEY_POINTS_RUBRIC_VERSION = 2;

export const KEY_POINT_DIMENSIONS = ["choice", "completeness", "faithfulness"] as const;
export type KeyPointDimension = (typeof KEY_POINT_DIMENSIONS)[number];

const Call = z.object({
  reason: z.string(),
  winner: z.enum(["A", "B", "tie"]),
});

export const KeyPointsAnswer = z.object({
  ...Object.fromEntries(KEY_POINT_DIMENSIONS.map((dimension) => [dimension, Call])),
  overall: Call,
} as Record<KeyPointDimension | "overall", typeof Call>);
export type KeyPointsAnswer = z.infer<typeof KeyPointsAnswer>;

const SYSTEM_PROMPT = `You compare two sets of key points written about the same YouTube video, for a reader who
saves videos instead of watching them. The key points are the part of the note they hear in
full, so they have to carry what the video says. You are given the video's transcript, with
timestamps, and two notes, A and B. Each note shows its one-line premise and core claim for
context, then its key points with the stretch of the video each comes from. Judge only the key
points. Which note came first means nothing, and neither is the reference.

Judge each dimension on its own, then overall:

- choice: these are the points a reader most needs to understand what the video says and why it
  matters. A point spent on something minor, or one that only repeats the premise or the core
  claim, is a wasted point.
- completeness: nothing important the video says is missing, wherever in the video it comes.
- faithfulness: every point is supported by the transcript. Caveats the video raises are kept,
  a claim the video presents as one person's stays theirs, and nothing is stated with more
  certainty than the video gives it. An invented specific is worse than a missing one.

The notes follow an editorial standard: a reader must be able to tell what the video said apart
from how much weight it bears. So a point should keep the qualifications and uncertainty the
video expresses, keep a significant counter-argument even when it complicates the summary,
attribute opinions and disputed claims to whoever makes them, and never present an anecdote as
proof of a general claim. A point that says what a claim rests on, such as one person's story,
a single case, or no figures given, is part of reporting the video faithfully. It is not
editorialising and not wasted space, as long as it is true of the transcript. Judge it under
faithfulness, and do not count it against choice. Facts brought in from outside the transcript
are still unsupported, however accurate.

Length is not quality, and more points are not better than fewer. Answer "tie" for a dimension
when neither set is meaningfully better on it. For overall, pick the set of key points the
reader would rather hear. Give the reason in one sentence before each winner.`;

const place = (point: Overview["keyPoints"][number]) =>
  point.range === null ? "built across the video" : `${formatTimestamp(point.range.startMs)}–${formatTimestamp(point.range.endMs)}`;

export const keyPointsForJudging = (overview: Overview): string =>
  [
    `Premise: ${overview.inOneLine}`,
    `Core claim: ${overview.coreClaim}`,
    "Key points:",
    ...overview.keyPoints.map((point, index) => `${index + 1}. [${place(point)}] ${point.text}`),
  ].join("\n");

export function keyPointsPrompt(fetched: FetchedTranscript, noteA: Overview, noteB: Overview) {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `${transcriptForJudging(fetched)}

=== Note A ===
${keyPointsForJudging(noteA)}

=== Note B ===
${keyPointsForJudging(noteB)}`,
    schema: KeyPointsAnswer,
  };
}
