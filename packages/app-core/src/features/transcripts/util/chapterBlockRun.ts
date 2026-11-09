import { blockAtPosition } from "./blockAtPosition.js";

export interface ChapterBlockRun {
  from: number;
  to: number;
}

// Every block holding any of a chapter's words: the one its first words fall in, through
// the last one that begins before the chapter ends. Chapters are contiguous
// (docs/features/chapters.md), so a block the boundary runs through carries the tail of
// one and the head of the next and belongs to both runs. Only the chapter the reader
// opened is ever marked, so the two are never on screen together.
export function chapterBlockRun(blocks: { startMs: number }[], chapter: { startMs: number; endMs: number }): ChapterBlockRun | null {
  const from = blockAtPosition(blocks, chapter.startMs);
  if (from === -1) {
    return null;
  }
  let to = from;
  for (let index = from + 1; index < blocks.length && blocks[index]!.startMs < chapter.endMs; index += 1) {
    to = index;
  }
  return { from, to };
}
