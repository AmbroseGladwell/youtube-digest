// Code in an answer, a fenced block or `inline`, open or closed (OV-364).
const CODE = /```[\s\S]*?(?:```|$)|`[^`\n]*(?:`|$)/g;
const HOLDER = /\uE000(\d+)\uE000/g;

// Applies a clean-up to an answer's prose only, so code keeps its spaces, dashes and brackets
// exactly as written: each piece of code is held aside while the prose is cleaned, then put back.
export function outsideCode(text: string, clean: (prose: string) => string): string {
  const held: string[] = [];
  const prose = text.replace(CODE, (code) => `\uE000${held.push(code) - 1}\uE000`);
  return clean(prose).replace(HOLDER, (_, index: string) => held[Number(index)] ?? "");
}
