import type { AdjustedIngredient, IngredientPiece } from "./adjustIngredient.js";

export interface MethodAmount {
  written: string;
  adjusted: string;
  names: readonly string[];
  plural: { from: string; to: string } | null;
}

const NOT_A_NAME = /^(?:of|the|and|or|plus|to|for|into|with|a|an|extra|about)$/i;
const FRACTIONS = "¼½¾⅓⅔⅛⅜⅝⅞";
const singular = (word: string) => word.toLowerCase().replace(/(?:es|s)$/, "");

const nameWords = (tail: string): string[] =>
  (tail.split(/[,(;]/, 1)[0] ?? "")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ""))
    .filter((word) => word.length >= 3 && !NOT_A_NAME.test(word))
    .map(singular);

// The amounts the method can follow: each adjusted ingredient line's amount as the page wrote it,
// with the words that name it. A tin sold at its size has nothing the method repeats.
export function methodAmounts(ingredients: readonly string[], lines: readonly AdjustedIngredient[]): MethodAmount[] {
  return lines.flatMap((line, index) => {
    if (line.kind !== "adjusted" || line.packAsSold) return [];
    const ingredient = ingredients[index] ?? "";
    const at = ingredient.indexOf(line.written);
    const changed = line.pieces.find((piece) => piece.changed);
    if (at === -1 || changed === undefined) return [];
    return [
      { written: line.written, adjusted: changed.text, names: nameWords(ingredient.slice(at + line.written.length)), plural: line.plural },
    ];
  });
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Edit {
  start: number;
  end: number;
  text: string;
  changed: boolean;
}

// A method number changes only where it repeats an ingredient line: the same amount as written,
// followed by a word of that ingredient's name ("Put 100g plain flour" for "100g plain flour").
// A share ("1 tbsp of the oil", "about 3 tbsp of the batter") is followed by "of", never a name,
// so it stays as written: one may be part of the batch and the other per pancake, and code can't
// tell which (design 231k, owner 8 Nov 2026). Times, sizes and counts of pieces never match.
export function methodPieces(text: string, amounts: readonly MethodAmount[]): IngredientPiece[] {
  const edits: Edit[] = [];
  for (const amount of amounts) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\d.,/${FRACTIONS}-])${escaped(amount.written)}(?![\\p{L}\\d/${FRACTIONS}])(\\s+)([\\p{L}]+)`,
      "giu",
    );
    for (const match of text.matchAll(pattern)) {
      if (!amount.names.includes(singular(match[2]!))) continue;
      const start = match.index;
      const end = start + amount.written.length;
      if (edits.some((edit) => start < edit.end && end > edit.start)) continue;
      edits.push({ start, end, text: amount.adjusted, changed: true });
      if (amount.plural === null) continue;
      const noun = new RegExp(`^((?:\\s+\\S+){0,3}?\\s+)(${escaped(amount.plural.from)})(?![\\p{L}])`, "iu").exec(text.slice(end));
      if (noun !== null) {
        const nounStart = end + noun[1]!.length;
        edits.push({ start: nounStart, end: nounStart + noun[2]!.length, text: amount.plural.to, changed: false });
      }
    }
  }
  edits.sort((a, b) => a.start - b.start);
  const pieces: IngredientPiece[] = [];
  let from = 0;
  for (const edit of edits) {
    if (edit.start > from) pieces.push({ text: text.slice(from, edit.start), changed: false });
    pieces.push({ text: edit.text, changed: edit.changed });
    from = edit.end;
  }
  if (from < text.length) pieces.push({ text: text.slice(from), changed: false });
  return pieces;
}

export const inMethodAmounts = (text: string, amounts: readonly MethodAmount[]): string =>
  amounts.length === 0
    ? text
    : methodPieces(text, amounts)
        .map((piece) => piece.text)
        .join("");
