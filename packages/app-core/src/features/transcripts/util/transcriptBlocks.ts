import type { TranscriptSegment } from "@overview/types";
import type { TranscriptBlock } from "../types/TranscriptBlock.js";

// Ported from zarazhangrui/youtube-digest's groupTranscriptEntries, logic not file
// (CLAUDE.md). The limits, and what this drops from it, are in docs/features/transcript-storage.md.
const LIMITS = {
  minChars: 180,
  idealChars: 180,
  maxChars: 320,
  runOnChars: 384,
  impatientMs: 8_000,
  clauseMs: 20_000,
  runOnMs: 25_000,
  silenceMs: 4_000,
} as const;

const SPEAKER_MARKER = /^\s*>>+\s*/;
// Only the bracketed words that are never speech: a captioner may also bracket a speaker's
// name (docs/features/transcript-storage.md), and that is theirs to keep.
const NON_SPEECH = /\[[^\]]*\b(?:music|applause|applaud\w*|laugh\w*|cheer\w*)\b[^\]]*\]/gi;
const CLOSERS = `["'’”»)\\]）】」』]*`;
const SENTENCE_END = new RegExp(`[.!?。！？]${CLOSERS}$`);
const CLAUSE_END = new RegExp(`[;:,；：，]${CLOSERS}$`);
const SENTENCE_PARTS = new RegExp(`[^.!?;:,。！？；：，]+(?:[.!?;:,。！？；：，]+${CLOSERS}|$)`, "g");
const SPLIT_PATTERNS = [/[;:；：]\s*/g, /[,，]\s*/g, /\s/g];

interface CaptionPiece {
  text: string;
  startMs: number;
  endMs: number;
  sentenceEnd: boolean;
  clauseEnd: boolean;
  speakerChange: boolean;
}

export function transcriptBlocks(segments: TranscriptSegment[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  let open: TranscriptBlock | null = null;

  for (const piece of captionPieces(segments)) {
    if (open !== null && startsNewBlock(open, piece)) {
      blocks.push(open);
      open = null;
    }
    open =
      open === null
        ? {
            text: piece.text,
            startMs: piece.startMs,
            endMs: piece.endMs,
            speakerChange: piece.speakerChange,
          }
        : {
            text: `${open.text} ${piece.text}`,
            startMs: open.startMs,
            endMs: piece.endMs,
            speakerChange: open.speakerChange,
          };

    if (endsBlock(open, piece)) {
      blocks.push(open);
      open = null;
    }
  }
  if (open !== null) {
    blocks.push(open);
  }
  return blocks;
}

function startsNewBlock(open: TranscriptBlock, piece: CaptionPiece): boolean {
  return (
    piece.speakerChange ||
    piece.startMs - open.endMs >= LIMITS.silenceMs ||
    piece.startMs - open.startMs >= LIMITS.runOnMs
  );
}

function endsBlock(open: TranscriptBlock, piece: CaptionPiece): boolean {
  const elapsedMs = piece.startMs - open.startMs;
  const atNaturalBoundary =
    piece.sentenceEnd ||
    (piece.clauseEnd && (open.text.length >= LIMITS.idealChars || elapsedMs >= LIMITS.clauseMs));

  return (
    (atNaturalBoundary && (open.text.length >= LIMITS.minChars || elapsedMs >= LIMITS.impatientMs)) ||
    open.text.length >= LIMITS.runOnChars
  );
}

function captionPieces(segments: TranscriptSegment[]): CaptionPiece[] {
  const pieces: CaptionPiece[] = [];

  for (const segment of segments) {
    const speakerChange = SPEAKER_MARKER.test(segment.text);
    const text = normaliseCaption(segment.text);
    if (text === "") {
      continue;
    }
    let opensTheCaption = true;

    for (const sentencePart of text.match(SENTENCE_PARTS) ?? [text]) {
      const parts = splitOversizedPart(normaliseCaption(sentencePart));
      for (const part of parts) {
        pieces.push({
          text: part,
          startMs: segment.startMs,
          endMs: segment.endMs,
          sentenceEnd: SENTENCE_END.test(part) || parts.length > 1,
          clauseEnd: CLAUSE_END.test(part),
          speakerChange: speakerChange && opensTheCaption,
        });
        opensTheCaption = false;
      }
    }
  }
  return pieces;
}

function normaliseCaption(text: string): string {
  return text
    .replace(SPEAKER_MARKER, "")
    .replace(NON_SPEECH, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?，。；：！？])/g, "$1")
    .trim();
}

function splitOversizedPart(text: string): string[] {
  const parts: string[] = [];
  let rest = text;

  while (rest.length > LIMITS.maxChars) {
    const cut = cutPoint(rest.slice(0, LIMITS.maxChars + 1));
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest !== "") {
    parts.push(rest);
  }
  return parts;
}

function cutPoint(window: string): number {
  const lowerBound = Math.floor(LIMITS.maxChars * 0.55);

  for (const pattern of SPLIT_PATTERNS) {
    let cut = 0;
    for (const match of window.matchAll(pattern)) {
      if (match.index !== undefined && match.index >= lowerBound) {
        cut = match.index + match[0].length;
      }
    }
    if (cut > 0) {
      return cut;
    }
  }
  return LIMITS.maxChars;
}
