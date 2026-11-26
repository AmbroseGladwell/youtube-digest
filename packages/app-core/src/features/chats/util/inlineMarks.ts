export interface MarkedPiece {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  href?: string;
}

// Where each piece came from in the marked text, for the read-aloud highlight (OV-418).
export interface PlacedPiece extends MarkedPiece {
  from: number;
  to: number;
}

const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)/;
const PARTIAL_LINK = /^\[[^\]\n]*(?:\]\([^)\s]*)?$/;
const SAFE_HREF = /^https?:\/\//i;
const WORD = /[\p{L}\p{N}]/u;

// The rules: docs/features/chats.md, "Inside an overview's chat (OV-354, pages 1, 2 and 5)".
export const inlineMarks = (text: string, options: { open?: "bold" | "plain" } = {}): MarkedPiece[] =>
  placedMarks(text, options).map(({ from: _from, to: _to, ...piece }) => piece);

export const placedMarks = (text: string, { open = "plain" }: { open?: "bold" | "plain" } = {}): PlacedPiece[] => {
  const streaming = open === "bold";
  const pieces: PlacedPiece[] = [];
  let bold = false;
  let italic = false;
  let boldFrom = 0;
  let italicFrom = 0;
  let buffer = "";
  let bufferFrom = 0;
  const flush = () => {
    if (buffer !== "") {
      pieces.push({ text: buffer, bold, italic, code: false, from: bufferFrom, to: bufferFrom + buffer.length });
    }
    buffer = "";
  };

  for (let at = 0; at < text.length;) {
    const rest = text.slice(at);
    const char = text[at]!;
    const before = text[at - 1] ?? " ";
    const after = text[at + 1] ?? " ";

    if (char === "`") {
      const end = text.indexOf("`", at + 1);
      if (end > at + 1 || (end === -1 && streaming)) {
        flush();
        pieces.push({
          text: text.slice(at + 1, end === -1 ? text.length : end),
          bold,
          italic,
          code: true,
          from: at,
          to: end === -1 ? text.length : end + 1,
        });
        at = end === -1 ? text.length : end + 1;
        continue;
      }
    }
    if (rest.startsWith("**")) {
      flush();
      bold = !bold;
      boldFrom = pieces.length;
      at += 2;
      continue;
    }
    if ((char === "*" || char === "_") && (italic ? !WORD.test(after) || char === "*" : WORD.test(after) && !WORD.test(before))) {
      if (!(char === "*" && after === " " && !italic)) {
        flush();
        italic = !italic;
        italicFrom = pieces.length;
        at += 1;
        continue;
      }
    }
    if (char === "[") {
      const link = LINK.exec(rest);
      if (link !== null) {
        flush();
        const [whole, words, href] = link;
        pieces.push({
          text: words!,
          bold,
          italic,
          code: false,
          from: at,
          to: at + whole.length,
          ...(SAFE_HREF.test(href!) ? { href: href! } : {}),
        });
        at += whole.length;
        continue;
      }
      if (streaming && PARTIAL_LINK.test(rest)) {
        buffer += rest.slice(1).replace(/\]\(.*$/, "");
        break;
      }
    }
    if (buffer === "") {
      bufferFrom = at;
    }
    buffer += char;
    at += 1;
  }
  flush();

  if (!streaming && bold) {
    for (const piece of pieces.slice(boldFrom)) {
      piece.bold = false;
    }
  }
  if (!streaming && italic) {
    for (const piece of pieces.slice(italicFrom)) {
      piece.italic = false;
    }
  }
  return pieces.filter((piece) => piece.text !== "");
};

export const markedWords = (words: readonly string[], whole: boolean): MarkedPiece[] => {
  return inlineMarks(words.join(""), { open: whole ? "plain" : "bold" }).flatMap((piece) =>
    piece.code || piece.href !== undefined ? [piece] : (piece.text.match(/\S+\s*|\s+/g) ?? []).map((word) => ({ ...piece, text: word })),
  );
};
