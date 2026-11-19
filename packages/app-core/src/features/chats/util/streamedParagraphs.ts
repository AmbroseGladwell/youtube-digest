// An answer still arriving, laid out as the final answer will be: a word still being written is held back until it is whole.
export const streamedParagraphs = (text: string, whole: boolean): string[][] =>
  (whole ? text : text.replace(/\S+$/, ""))
    .split(/\n+/)
    .filter((paragraph) => paragraph.trim() !== "")
    .map((paragraph) => paragraph.trimStart().match(/\S+\s*/g) ?? []);
