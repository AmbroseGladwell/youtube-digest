import type { MarkedPiece, PlacedPiece } from "./inlineMarks.js";

export interface SpokenRange {
  start: number;
  end: number;
}

export interface SpokenPiece {
  piece: MarkedPiece;
  spoken: boolean;
}

const plainCut = (piece: PlacedPiece, from: number, to: number): MarkedPiece => ({
  ...piece,
  text: piece.text.slice(from - piece.from, to - piece.from),
});

// Cuts plain text at the sentence's edges; a link or inline code is spoken whole or not at all.
export const spokenPieces = (pieces: readonly PlacedPiece[], range: SpokenRange | null): SpokenPiece[] =>
  pieces.flatMap((piece): SpokenPiece[] => {
    if (range === null || piece.to <= range.start || piece.from >= range.end) {
      return [{ piece, spoken: false }];
    }
    if (piece.code || piece.href !== undefined) {
      return [{ piece, spoken: true }];
    }
    const start = Math.max(range.start, piece.from);
    const end = Math.min(range.end, piece.to);
    return [
      { piece: plainCut(piece, piece.from, start), spoken: false },
      { piece: plainCut(piece, start, end), spoken: true },
      { piece: plainCut(piece, end, piece.to), spoken: false },
    ].filter(({ piece: cut }) => cut.text !== "");
  });
