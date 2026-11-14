// Some recipe plugins wrap an ingredient's note in brackets when the note already has its own:
// "flour ((cake flour OK too, Note 1))", "butter (, cut into cubes)". The outer pair goes, and a
// note that starts with a comma follows the name as one would have written it.
export function tidyIngredient(line: string): string {
  let text = line;
  for (let open = text.indexOf("("); open !== -1; open = text.indexOf("(", open + 1)) {
    const close = matching(text, open);
    if (close === -1) break;
    const inside = text.slice(open + 1, close);
    const lead = inside.trimStart();
    if (!lead.startsWith("(") && !lead.startsWith(",")) continue;
    const before = lead.startsWith(",") ? text.slice(0, open).trimEnd() : text.slice(0, open);
    text = `${before}${lead.trimEnd()}${text.slice(close + 1)}`;
    open = before.length - 1;
  }
  return text.replace(/\s{2,}/g, " ").trim();
}

const matching = (text: string, open: number): number => {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === "(") depth += 1;
    if (text[at] === ")") depth -= 1;
    if (depth === 0) return at;
  }
  return -1;
};
