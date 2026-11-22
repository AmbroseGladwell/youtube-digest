export type AnswerBlock = { kind: "paragraph"; text: string } | { kind: "code"; language: string; code: string };

const FENCE = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;

const paragraphsOf = (prose: string): AnswerBlock[] =>
  prose
    .split(/\n+/)
    .filter((paragraph) => paragraph.trim() !== "")
    .map((paragraph) => ({ kind: "paragraph", text: paragraph.trim() }));

// A fence still open at the end is already a code block while the answer streams (OV-364).
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

export const holdsCodeBlock = (text: string): boolean => answerBlocks(text).some((block) => block.kind === "code");
