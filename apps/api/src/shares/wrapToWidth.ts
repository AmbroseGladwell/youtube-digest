export interface WrapToWidthInput {
  text: string;
  maxWidth: number;
  maxLines: number;
  measure: (line: string) => number;
}

// Measured widths, not a character count: docs/features/sharing.md, "The card image".
export const wrapToWidth = ({ text, maxWidth, maxLines, measure }: WrapToWidthInput): string[] => {
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
};

const ellipsise = (line: string, maxWidth: number, measure: (line: string) => number): string => {
  let trimmed = line;
  while (trimmed !== "" && measure(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }
  return `${trimmed}…`;
};
