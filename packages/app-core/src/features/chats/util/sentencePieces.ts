import type { MarkedPiece, PlacedPiece } from "./inlineMarks.js";

export interface SentenceRange {
  index: number;
  start: number;
  end: number;
}

export interface SentencePiece {
  piece: MarkedPiece;
  sentence: number | null;
}

const cut = (piece: PlacedPiece, from: number, to: number): MarkedPiece => ({
  ...piece,
  text: piece.text.slice(from - piece.from, to - piece.from),
});

// Plain text is cut at each sentence's edges; a link or inline code goes whole to the sentence it starts in.
export const sentencePieces = (pieces: readonly PlacedPiece[], ranges: readonly SentenceRange[]): SentencePiece[] =>
  pieces.flatMap((piece): SentencePiece[] => {
    const touching = ranges.filter((range) => range.start < piece.to && range.end > piece.from);
    if (touching.length === 0) {
      return [{ piece, sentence: null }];
    }
    if (piece.code || piece.href !== undefined) {
      return [{ piece, sentence: touching[0]!.index }];
    }
    const out: SentencePiece[] = [];
    let at = piece.from;
    for (const range of touching) {
      const start = Math.max(range.start, piece.from);
      const end = Math.min(range.end, piece.to);
      if (start > at) {
        out.push({ piece: cut(piece, at, start), sentence: null });
      }
      out.push({ piece: cut(piece, start, end), sentence: range.index });
      at = end;
    }
    if (at < piece.to) {
      out.push({ piece: cut(piece, at, piece.to), sentence: null });
    }
    return out.filter(({ piece: each }) => each.text !== "");
  });

export interface SentenceGroup {
  sentence: number | null;
  pieces: MarkedPiece[];
}

export const groupBySentence = (pieces: readonly SentencePiece[]): SentenceGroup[] =>
  pieces.reduce<SentenceGroup[]>((groups, { piece, sentence }) => {
    const last = groups.at(-1);
    if (last !== undefined && last.sentence === sentence) {
      last.pieces.push(piece);
    } else {
      groups.push({ sentence, pieces: [piece] });
    }
    return groups;
  }, []);
