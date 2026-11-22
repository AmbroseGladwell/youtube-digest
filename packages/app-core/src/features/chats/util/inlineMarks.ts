export interface MarkedPiece {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  // A link's address: only ever http or https.
  href?: string;
}

const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)/;
const PARTIAL_LINK = /^\[[^\]\n]*(?:\]\([^)\s]*)?$/;
const SAFE_HREF = /^https?:\/\//i;
const WORD = /[\p{L}\p{N}]/u;

// An answer's inline Markdown (OV-362, OV-364): **bold**, *italics* or _italics_, `code` and
// [links](https://…), in pieces with the markers gone. Nothing else is read: raw HTML stays text. A
// mark still open at the end is shown as it will be while the answer streams in, and as plain text
// once it is whole; a link only half written shows its words alone. A link to anything but http(s)
// keeps its words and drops the address.
export const inlineMarks = (text: string, { open = "plain" }: { open?: "bold" | "plain" } = {}): MarkedPiece[] => {
  const streaming = open === "bold";
  const pieces: MarkedPiece[] = [];
  let bold = false;
  let italic = false;
  let boldFrom = 0;
  let italicFrom = 0;
  let buffer = "";
  const flush = () => {
    if (buffer !== "") {
      pieces.push({ text: buffer, bold, italic, code: false });
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
        pieces.push({ text: text.slice(at + 1, end === -1 ? text.length : end), bold, italic, code: true });
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
        pieces.push({ text: words!, bold, italic, code: false, ...(SAFE_HREF.test(href!) ? { href: href! } : {}) });
        at += whole.length;
        continue;
      }
      if (streaming && PARTIAL_LINK.test(rest)) {
        buffer += rest.slice(1).replace(/\]\(.*$/, "");
        break;
      }
    }
    buffer += char;
    at += 1;
  }
  flush();

  // Once whole, a mark that never closed was never a mark: what followed it reads as plain text.
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

// The same, word by word, for an answer whose words fade in as they arrive.
export const markedWords = (words: readonly string[], whole: boolean): MarkedPiece[] => {
  return inlineMarks(words.join(""), { open: whole ? "plain" : "bold" }).flatMap((piece) =>
    piece.code || piece.href !== undefined ? [piece] : (piece.text.match(/\S+\s*|\s+/g) ?? []).map((word) => ({ ...piece, text: word })),
  );
};
