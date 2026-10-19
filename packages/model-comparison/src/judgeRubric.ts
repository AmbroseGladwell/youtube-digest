import { z } from "zod";
import { formatTimestamp, overviewMarkdown, type Overview } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";

export const JUDGE_DIMENSIONS = ["faithfulness", "verdict", "howToApply", "chapters", "readsAloud"] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

const Call = z.object({
  reason: z.string(),
  winner: z.enum(["A", "B", "tie"]),
});
export type JudgeCall = z.infer<typeof Call>;

export const JudgeAnswer = z.object({
  ...Object.fromEntries(JUDGE_DIMENSIONS.map((dimension) => [dimension, Call])),
  overall: Call,
} as Record<JudgeDimension | "overall", typeof Call>);
export type JudgeAnswer = z.infer<typeof JudgeAnswer>;

const SYSTEM_PROMPT = `You compare two notes written about the same YouTube video, for a reader who saves videos
instead of watching them and wants to know what each one claims and whether it holds up. You
are given the video's transcript, with timestamps, and two notes, A and B. Judge each note
only against the transcript and the rules below. Which one came first means nothing, and
neither is the reference.

The notes follow a fixed format: a premise, the core claim, a verdict on how new the content
is with any dubious claims, key points, how to apply it, what the creator is selling, whether
to watch it anyway, and chapters. Every field is shown on screen and also read aloud.

Judge each dimension on its own, then overall:

- faithfulness: every claim, name and number in the note is supported by the transcript, and
  nothing important the video says is left out or distorted. An invented specific is worse
  than a missing one. Caveats the video raises are kept.
- verdict: the novelty call is calibrated and blunt. Most videos repackage common knowledge
  and saying so is correct. A claim is called dubious only when it is stated with more
  certainty than it has earned, never just because it is contested or new. "Watch it anyway"
  is yes only when the visual or the sound itself is the content.
- howToApply: the steps are specific and usable by this reader tomorrow, not generic advice.
- chapters: the boundaries fall where the subject actually changes, the titles say what each
  stretch covers, and the list reads as a map of the video.
- readsAloud: complete, natural sentences that make sense heard in order. No fragments,
  labels, or lists introduced with a colon.

Length is not quality: a longer note is better only if what it adds is true and useful.
Answer "tie" for a dimension when neither note is meaningfully better on it. For overall,
pick the note the reader would rather have. Give the reason in one sentence before each
winner.`;

const transcriptLines = (fetched: FetchedTranscript) =>
  fetched.transcript.map((segment) => `[${formatTimestamp(segment.startMs)}] ${segment.text}`).join("\n");

export const noteForJudging = (overview: Overview): string =>
  overviewMarkdown(overview)
    .replace(/\]\(https?:\/\/[^)]+\)/g, "]")
    .replace(/^https?:\/\/\S+$/gm, "")
    .replace(/ · saved \d{4}-\d{2}-\d{2}/, "");

export function judgePrompt(fetched: FetchedTranscript, noteA: Overview, noteB: Overview) {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Title: ${fetched.video.title}
Channel: ${fetched.video.channel}

Transcript:
${transcriptLines(fetched)}

=== Note A ===
${noteForJudging(noteA)}

=== Note B ===
${noteForJudging(noteB)}`,
    schema: JudgeAnswer,
  };
}
