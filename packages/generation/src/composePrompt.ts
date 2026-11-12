import { wordCount, type NoteKind } from "@overview/domain";
import { z } from "zod";
import type { GenerationInput } from "./GenerationInput.js";
import { chaptersTooBigToSkip, positionsInTheFinalStretch } from "./noteBudget.js";
import { enabledSections } from "./sectionRegistry.js";
import { descriptionOf } from "./recipe/videoRecipe.js";
import type { ChapterShape } from "./sections/chaptersSection.js";
import { segmentRangeOf, type SegmentRangeShape } from "./sections/segmentRangeFields.js";
import { transcriptBudget } from "./sections/transcriptBudget.js";

const VIDEO_TAG = /<(\/?)(video|title|channel|description|transcript)\b/gi;

function asVideoContent(text: string): string {
  return text.replace(VIDEO_TAG, "‹$1$2");
}

function contextBlock(input: GenerationInput): string {
  const transcript = input.transcript.map((segment, i) => `[${i}] ${asVideoContent(segment.text)}`).join("\n");
  return `
<video>
<title>${asVideoContent(input.video.title)}</title>
<channel>${asVideoContent(input.video.channel)}</channel>
<description>${descriptionOf(input) === "" ? "unavailable" : asVideoContent(descriptionOf(input))}</description>
<transcript>
${transcript}
</transcript>
</video>

Why they saved it: ${input.captureReason ?? "not said"}`;
}

// Only a long video is held to its whole length, so a short one's note and retries stay as
// they were (docs/features/overview-generation-decisions.md, "One note budget").
const keyPointsCoverALongVideo = (input: GenerationInput) => (output: Record<string, unknown>, ctx: z.RefinementCtx) => {
  if (!transcriptBudget(input).long) return;
  const segmentWords = input.transcript.map(({ text }) => wordCount(text));
  const ranges = (output.keyPoints as SegmentRangeShape[]).flatMap((point) => segmentRangeOf(point) ?? []);
  const reaches = (from: number, to: number) =>
    ranges.some(({ startSegmentIndex, endSegmentIndex }) => startSegmentIndex <= to && endSegmentIndex >= from);
  const starts = (output.chapters as ChapterShape[]).map(({ startSegmentIndex }) => startSegmentIndex);
  for (const index of chaptersTooBigToSkip(segmentWords, starts)) {
    const last = (starts[index + 1] ?? segmentWords.length) - 1;
    if (!reaches(starts[index]!, last)) {
      ctx.addIssue({
        code: "custom",
        path: ["keyPoints"],
        message: `chapter "${(output.chapters as ChapterShape[])[index]!.title}" is too much of the video to leave out: at least one key point must come from segments ${starts[index]} to ${last}`,
      });
    }
  }
  const finalStretch = positionsInTheFinalStretch(segmentWords);
  if (finalStretch.size > 0) {
    const from = Math.min(...finalStretch);
    if (!reaches(from, segmentWords.length - 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["keyPoints"],
        message: `the key points stop early: at least one must come from segment ${from} onwards, so the note represents the whole video`,
      });
    }
  }
};

export interface ComposedPrompt {
  systemPrompt: string;
  userMessage: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

export const WRITING_RULES =
  "Never use an em dash (—) anywhere in your output; use a period or a comma instead. " +
  "Every field is read on screen and also read aloud, so write for the ear as well as the eye: " +
  "complete, natural sentences, no colons introducing lists, and no abbreviations a listener would have to decode. " +
  "Keep numbers, money and symbols as digits and symbols, such as $600, 20% or 8×7; they are converted for speech separately. " +
  "Brief parentheses are allowed only for a specific such as a year or a citation. They are not read aloud, " +
  "so never put anything the sentence needs inside them.";

const SYSTEM_OPENING: Record<NoteKind, string> = {
  default:
    "You produce a blunt judgment record of a saved video for one reader, from its transcript alone. Follow the sections below exactly. ",
  process:
    "You produce a blunt judgment record of a saved video for one reader, from its transcript alone. Follow the sections below exactly. ",
  recipe:
    "You write the note on a saved recipe video for one reader, from its transcript and description alone. Follow the sections below exactly. ",
};

export function composePrompt(input: GenerationInput, kind: NoteKind = "default"): ComposedPrompt {
  const sections = enabledSections(input, kind);

  const instructions = sections.map((section) => section.prompt(input)).join("\n");

  const shape: Record<string, z.ZodType> = {};
  for (const section of sections) {
    const sectionShape = section.schemaShape(input);
    if (section.key === "structural") {
      Object.assign(shape, sectionShape);
    } else {
      shape[section.key] = z.object(sectionShape);
    }
  }

  const schema = z.object(shape);
  return {
    systemPrompt: SYSTEM_OPENING[kind] + WRITING_RULES + instructions,
    userMessage: contextBlock(input),
    schema: kind === "recipe" ? schema : schema.superRefine(keyPointsCoverALongVideo(input)),
  };
}
