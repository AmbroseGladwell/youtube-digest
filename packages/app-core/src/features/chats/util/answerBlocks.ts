export type AnswerBlock = { kind: "paragraph"; text: string } | { kind: "code"; language: string; code: string };

const FENCE = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;

const paragraphsOf = (prose: string): AnswerBlock[] =>
  prose
    .split(/\n+/)
    .filter((paragraph) => paragraph.trim() !== "")
    .map((paragraph) => ({ kind: "paragraph", text: paragraph.trim() }));

// An answer's text as it is drawn (OV-364): paragraphs, one a line, and fenced code blocks, which
// keep their lines. A fence still open at the end is a code block already while the answer streams.
export const answerBlocks = (text: string): AnswerBlock[] => {
  const blocks: AnswerBlock[] = [];
  let from = 0;
  for (const fence of text.matchAll(FENCE)) {
    blocks.push(...paragraphsOf(text.slice(from, fence.index)));
    const language = fence[1]!.trim().split(/\s+/)[0] ?? "";
    blocks.push({ kind: "code", language, code: fence[2]!.replace(/\n$/, "") });
    from = fence.index + fence[0].length;
  }
  blocks.push(...paragraphsOf(text.slice(from)));
  return blocks;
};
