import { blockAtPosition } from "./blockAtPosition.js";

export interface ChapterBlockRun {
  from: number;
  to: number;
}

export interface ChapterSpan {
  startMs: number;
  endMs: number;
}

// A block a chapter boundary runs through belongs to both chapters' runs.
export const chapterBlockRun = (blocks: { startMs: number }[], chapter: ChapterSpan): ChapterBlockRun | null => {
  const from = blockAtPosition(blocks, chapter.startMs);
  if (from === -1) {
    return null;
  }
  let to = from;
  for (let index = from + 1; index < blocks.length && blocks[index]!.startMs < chapter.endMs; index += 1) {
    to = index;
  }
  return { from, to };
};
