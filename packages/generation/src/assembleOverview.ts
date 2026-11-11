import {
  HowToApply,
  Overview,
  Selling,
  Verdict,
  WatchAnyway,
  recipeNote,
  resolveTags,
  youTubeSource,
  type Chapter,
  type DubiousClaim,
  type Novelty,
  type StandsOut,
  type OverviewId,
} from "@overview/domain";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput, GeneratedRecipeVideoOutput, GeneratedTimedText } from "./GeneratedOutput.js";
import type { ChapterShape } from "./sections/chaptersSection.js";
import type { DubiousClaimShape } from "./sections/verdictSection.js";
import { GenerationError } from "./GenerationError.js";
import { videoRecipe } from "./recipe/videoRecipe.js";
import { sourceStepsOf } from "./sourceStepsOf.js";
import { segmentRangeOf } from "./sections/segmentRangeFields.js";
import { resolvedBigPicture } from "./sections/bigPicturePrompt.js";
import { transcriptBudget } from "./sections/transcriptBudget.js";

type Meta = { id: OverviewId; savedAt: string };

function commonFields(input: GenerationInput, output: GeneratedRecipeVideoOutput | GeneratedOutput, meta: Meta) {
  const topicIds = input.existingTopics.filter((topic) => output.matchedTopicNames.includes(topic.name)).map((topic) => topic.id);
  return {
    id: meta.id,
    source: youTubeSource(input.video),
    savedAt: meta.savedAt,
    captureReason: input.captureReason,
    fromPlaylist: null,
    madeOn: null,
    inOneLine: output.inOneLine,
    topicIds,
    tags: resolveTags(output.tags, {
      known: new Set(input.existingTags.map(({ tag }) => tag)),
      aliases: input.tagAliases,
    }),
    chapters: resolveChapters(input, output.chapters),
    article: null,
  };
}

// A recipe video's note is its recipe, with the chapters a video has (docs/features/recipe-notes.md).
// Null when no ingredient survives the amount check, so the video gets its ordinary note.
export function assembleRecipeVideoOverview(input: GenerationInput, output: GeneratedRecipeVideoOutput, meta: Meta): Overview | null {
  const recipe = output.recipe === null ? null : videoRecipe(input, output.recipe);
  if (recipe === null || output.recipe === null) return null;
  return Overview.parse({
    ...commonFields(input, output, meta),
    bigPicture: null,
    sourceSteps: null,
    coreClaim: "",
    thin: false,
    keyPoints: [],
    verdict: null,
    selling: null,
    howToApply: null,
    watchAnyway: null,
    recipe: recipeNote(recipe, output.recipe.summary),
  });
}

export function assembleOverview(input: GenerationInput, output: GeneratedOutput, meta: Meta): Overview {
  const common = commonFields(input, output, meta);

  const verdict =
    !output.thin && output.verdict
      ? Verdict.parse({
          novelty: output.verdict.novelty,
          standsOut: resolveStandsOut(input, output.verdict.novelty, output.verdict.standsOut),
          dubious: output.verdict.dubiousClaims.length > 0,
          dubiousClaims: resolveDubiousClaims(input, output.verdict.dubiousClaims),
          reasoning: output.verdict.reasoning,
          similarTo: output.verdict.similarToIndices
            .filter((i) => i >= 0 && i < input.pastClaims.length)
            .map((i) => {
              const claim = input.pastClaims[i]!;
              return { overviewId: claim.overviewId, title: claim.title };
            }),
        })
      : null;

  const selling = output.selling ? Selling.parse(output.selling) : null;
  const sourceSteps = sourceStepsOf(
    output.sourceSteps.map(({ text, dubious, ...range }) => ({ text, dubious, range: resolveOptionalRange(input, segmentRangeOf(range)) })),
  );
  const howToApply = output.howToApply ? HowToApply.parse(output.howToApply) : null;
  const watchAnyway = output.watchAnyway
    ? WatchAnyway.parse({
        answer: output.watchAnyway.answer,
        reason: output.watchAnyway.reason,
        range: resolveRange(input, segmentRangeOf(output.watchAnyway)),
      })
    : null;

  return Overview.parse({
    ...common,
    bigPicture: resolvedBigPicture(transcriptBudget(input).bigPictureWords, output.bigPicture),
    coreClaim: output.coreClaim,
    thin: output.thin,
    keyPoints: output.keyPoints.map((point) => ({ text: point.text, range: resolveOptionalRange(input, segmentRangeOf(point)) })),
    verdict,
    selling,
    sourceSteps,
    howToApply,
    watchAnyway,
    recipe: null,
  });
}

// docs/features/novelty-scale.md, "What stands out".
function resolveStandsOut(input: GenerationInput, novelty: Novelty, standsOut: GeneratedTimedText | null): StandsOut | null {
  const text = standsOut?.text.trim() ?? "";
  if (novelty === "common_knowledge" || text === "") {
    return null;
  }
  return { text, range: resolveOptionalRange(input, standsOut === null ? null : segmentRangeOf(standsOut)) };
}

// A stretch a line merely points at: one that doesn't fit the transcript loses its jump
// rather than failing the overview (docs/features/novelty-scale.md).
function resolveOptionalRange(
  input: GenerationInput,
  range: { startSegmentIndex: number; endSegmentIndex: number } | null,
): { startMs: number; endMs: number } | null {
  const fits = range !== null && range.startSegmentIndex <= range.endSegmentIndex && range.endSegmentIndex < input.transcript.length;
  return fits ? resolveRange(input, range) : null;
}

// Each chapter ends where the next begins, and the last where the words do, not where
// the video does (docs/features/chapters.md).
function resolveChapters(input: GenerationInput, chapters: ChapterShape[]): Chapter[] {
  const segmentAt = (index: number) => {
    const segment = input.transcript[index];
    if (!segment) {
      throw new GenerationError(
        `a chapter referenced a segment index out of bounds: ${index} ` + `(transcript has ${input.transcript.length} segments)`,
      );
    }
    return segment;
  };
  const lastCaptionEndsMs = input.transcript.at(-1)?.endMs ?? 0;

  return chapters.map((chapter, index) => {
    const next = chapters[index + 1];
    return {
      title: chapter.title,
      summary: chapter.summary,
      startMs: segmentAt(chapter.startSegmentIndex).startMs,
      endMs: next ? segmentAt(next.startSegmentIndex).startMs : lastCaptionEndsMs,
    };
  });
}

function resolveDubiousClaims(input: GenerationInput, dubiousClaims: DubiousClaimShape[]): DubiousClaim[] {
  return dubiousClaims.map(({ segmentIndex, ...dubiousClaim }) => {
    if (segmentIndex === null) {
      return { ...dubiousClaim, startMs: null };
    }
    const segment = input.transcript[segmentIndex];
    if (!segment) {
      throw new GenerationError(
        `a dubious claim referenced a segment index out of bounds: ${segmentIndex} ` +
          `(transcript has ${input.transcript.length} segments)`,
      );
    }
    return { ...dubiousClaim, startMs: segment.startMs };
  });
}

function resolveRange(
  input: GenerationInput,
  range: { startSegmentIndex: number; endSegmentIndex: number } | null,
): { startMs: number; endMs: number } | null {
  if (!range) return null;
  const start = input.transcript[range.startSegmentIndex];
  const end = input.transcript[range.endSegmentIndex];
  if (!start || !end) {
    throw new GenerationError(
      `watch-it-anyway range referenced a segment index out of bounds: ` +
        `${range.startSegmentIndex}-${range.endSegmentIndex} ` +
        `(transcript has ${input.transcript.length} segments)`,
    );
  }
  return { startMs: start.startMs, endMs: end.endMs };
}
