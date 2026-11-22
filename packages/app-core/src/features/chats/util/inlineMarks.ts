export interface MarkedPiece {
  text: string;
  bold: boolean;
}

// An answer's **bold** words (OV-362): the text in pieces, bold or not, with the asterisks gone. A
// pair still open at the end is bold while the answer streams in, and plain once it is whole.
export function inlineMarks(text: string, { open = "plain" }: { open?: "bold" | "plain" } = {}): MarkedPiece[] {
  const parts = text.split("**");
  const closed = parts.length % 2 === 1;
  const pieces = parts.map((part, index) => {
    const unclosedLast = !closed && index === parts.length - 1;
    return { text: part, bold: index % 2 === 1 || (unclosedLast && open === "bold") };
  });
  if (!closed && open === "plain") {
    const last = pieces.pop()!;
    pieces.push({ text: last.text, bold: false });
  }
  return pieces.filter((piece) => piece.text !== "");
}

// The same, word by word, for an answer whose words fade in as they arrive.
export function markedWords(words: readonly string[], whole: boolean): MarkedPiece[] {
  return inlineMarks(words.join(""), { open: whole ? "plain" : "bold" }).flatMap((piece) =>
    (piece.text.match(/\S+\s*|\s+/g) ?? []).map((word) => ({ text: word, bold: piece.bold })),
  );
}
