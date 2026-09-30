export interface WrapToWidthInput {
  text: string;
  maxWidth: number;
  maxLines: number;
  measure: (line: string) => number;
}

// Wrapped against measured widths rather than a character count, because a guessed width
// overflows the card on exactly the long titles that most need wrapping
// (docs/prototype/constraints.md). A word too long to fit on a line of its own is left to
// overhang rather than broken mid-word.
export function wrapToWidth({ text, maxWidth, maxLines, measure }: WrapToWidthInput): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let index = 0;

  while (index < words.length && lines.length < maxLines) {
    const word = words[index]!;
    const candidate = current === "" ? word : `${current} ${word}`;
    if (current !== "" && measure(candidate) > maxWidth) {
      lines.push(current);
      current = "";
      continue;
    }
    current = candidate;
    index += 1;
  }

  if (current !== "" && lines.length < maxLines) {
    lines.push(current);
    current = "";
  }

  const dropped = index < words.length || current !== "";
  if (dropped && lines.length > 0) {
    lines[lines.length - 1] = ellipsise(lines[lines.length - 1]!, maxWidth, measure);
  }
  return lines;
}

const ellipsise = (line: string, maxWidth: number, measure: (line: string) => number): string => {
  let trimmed = line;
  while (trimmed !== "" && measure(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }
  return `${trimmed}…`;
};
