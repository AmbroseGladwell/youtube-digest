import {
  HowToApply,
  Overview,
  Selling,
  Verdict,
  WatchAnyway,
  type Chapter,
  type OverviewId,
} from "@overview/domain";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput } from "./GeneratedOutput.js";
import type { ChapterShape } from "./sections/chaptersSection.js";
import { GenerationError } from "./GenerationError.js";

export function assembleOverview(
  input: GenerationInput,
  output: GeneratedOutput,
  meta: { id: OverviewId; savedAt: string },
): Overview {
  const topicIds = input.existingTopics
    .filter((topic) => output.matchedTopicNames.includes(topic.name))
    .map((topic) => topic.id);

  const verdict =
    !output.thin && output.verdict
      ? Verdict.parse({
          novelty: output.verdict.novelty,
          dubious: output.verdict.dubious,
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
  const howToApply = output.howToApply ? HowToApply.parse(output.howToApply) : null;
  const watchAnyway = output.watchAnyway
    ? WatchAnyway.parse({
        answer: output.watchAnyway.answer,
        reason: output.watchAnyway.reason,
        range: resolveRange(input, output.watchAnyway.range),
      })
    : null;

  return Overview.parse({
    id: meta.id,
    video: input.video,
    savedAt: meta.savedAt,
    captureReason: input.captureReason,
    inOneLine: output.inOneLine,
    coreClaim: output.coreClaim,
    thin: output.thin,
    keyPoints: output.keyPoints,
    topicIds,
    tags: output.tags,
    verdict,
    selling,
    howToApply,
    watchAnyway,
    chapters: resolveChapters(input, output.chapters),
  });
}

// Each chapter ends where the next begins, and the last where the video does: the
// longer of YouTube's own length and the final caption's end, since a caption-derived
// duration can fall short of the captions it was derived from
// (docs/features/chapters.md).
function resolveChapters(input: GenerationInput, chapters: ChapterShape[]): Chapter[] {
  const segmentAt = (index: number) => {
    const segment = input.transcript[index];
    if (!segment) {
      throw new GenerationError(
        `a chapter referenced a segment index out of bounds: ${index} ` +
          `(transcript has ${input.transcript.length} segments)`,
      );
    }
    return segment;
  };
  const lastSegment = input.transcript.at(-1);
  const videoEndMs = Math.max(input.video.durationMs ?? 0, lastSegment?.endMs ?? 0);

  return chapters.map((chapter, index) => {
    const next = chapters[index + 1];
    return {
      title: chapter.title,
      summary: chapter.summary,
      startMs: segmentAt(chapter.startSegmentIndex).startMs,
      endMs: next ? segmentAt(next.startSegmentIndex).startMs : videoEndMs,
    };
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
