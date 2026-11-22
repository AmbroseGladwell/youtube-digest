const FENCED_OR_INLINE_CODE_OPEN_OR_CLOSED = /```[\s\S]*?(?:```|$)|`[^`\n]*(?:`|$)/g;
const HELD_CODE_PLACEHOLDER = /\uE000(\d+)\uE000/g;

export const outsideCode = (text: string, clean: (prose: string) => string): string => {
  const held: string[] = [];
  const prose = text.replace(FENCED_OR_INLINE_CODE_OPEN_OR_CLOSED, (code) => `\uE000${held.push(code) - 1}\uE000`);
  return clean(prose).replace(HELD_CODE_PLACEHOLDER, (_, index: string) => held[Number(index)] ?? "");
};
