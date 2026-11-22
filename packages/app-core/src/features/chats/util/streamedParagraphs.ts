export const streamedParagraphs = (text: string, whole: boolean): string[][] =>
  (whole ? text : text.replace(/\S+$/, ""))
    .split(/\n+/)
    .filter((paragraph) => paragraph.trim() !== "")
    .map((paragraph) => paragraph.trimStart().match(/\S+\s*/g) ?? []);
