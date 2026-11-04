import type { Recipe } from "@overview/domain";
import { isPageFurniture } from "./isPageFurniture.js";

type Facts = Pick<Recipe, "prepMinutes" | "cookMinutes" | "totalMinutes" | "yield">;
type Time = "prepMinutes" | "cookMinutes" | "totalMinutes";

const TIME_LABELS: [Time, RegExp][] = [
  ["prepMinutes", /^(prep|prepare|preparation)( time)?$/i],
  ["cookMinutes", /^(cook|cooking)( time)?$/i],
  ["totalMinutes", /^(total( time)?|ready in)$/i],
];
const DURATION = /^(?:(\d+)\s*(?:hours?|hrs?|h))?\s*(?:and\s*)?(?:(\d+)\s*(?:minutes?|mins?|m))?\.?$/i;
const LABELLED = /^([a-z ]+?)\s*:?\s*(\d.*)$/i;
const YIELD_LABEL = /^(serves|makes|yields?|servings|portions)$/i;
const MOST_WORDS_IN_A_YIELD = 6;
const INLINE = new Set(["A", "ABBR", "B", "BDI", "BDO", "CITE", "CODE", "DATA", "DFN", "EM", "FONT", "I", "KBD", "LABEL", "MARK", "Q", "S", "SAMP", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "VAR"]);
const UNREAD = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "SVG"]);
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const tidied = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();

const minutesIn = (written: string): number | null => {
  const parts = DURATION.exec(written.trim());
  if (parts === null || (parts[1] === undefined && parts[2] === undefined)) return null;
  return Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0) || null;
};

const linesBefore = (body: HTMLElement, end: Element): string[] => {
  const lines: string[] = [];
  let line = "";
  let ended = false;
  const endLine = () => {
    if (tidied(line) !== "") lines.push(tidied(line));
    line = "";
  };
  const visit = (node: Node): void => {
    if (ended) return;
    if (node.nodeType === TEXT_NODE) {
      line += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toUpperCase();
    if (element === end) {
      ended = true;
      return;
    }
    if (UNREAD.has(tag) || isPageFurniture(element)) return;
    const isBlock = !INLINE.has(tag);
    if (isBlock) endLine();
    element.childNodes.forEach(visit);
    if (isBlock) endLine();
  };
  visit(body);
  endLine();
  return lines;
};

const labelAndValue = (line: string, next: string | undefined): [string, string] | null => {
  const labelled = LABELLED.exec(line);
  if (labelled !== null) return [labelled[1]!, labelled[2]!];
  return next === undefined ? null : [line.replace(/\s*:$/, ""), next];
};

const theOnlyValue = <T>(values: T[]): T | null => {
  const [first] = values;
  return first !== undefined && values.every((value) => value === first) ? first : null;
};

// The times and yield a recipe read from markup labels as text, ahead of its method
// (docs/features/recipe-notes.md, "Read from the page itself").
export function labelledRecipeFacts(body: HTMLElement, method: Element): Facts {
  const times: Record<Time, number[]> = { prepMinutes: [], cookMinutes: [], totalMinutes: [] };
  const yields: string[] = [];
  const lines = linesBefore(body, method);
  lines.forEach((line, index) => {
    const found = labelAndValue(line, lines[index + 1]);
    if (found === null) return;
    const [label, value] = found;
    const time = TIME_LABELS.find(([, named]) => named.test(label))?.[0];
    const minutes = time === undefined ? null : minutesIn(value);
    if (time !== undefined && minutes !== null) times[time].push(minutes);
    const stated = `${label} ${value}`;
    if (YIELD_LABEL.test(label) && /\d/.test(value) && stated.split(" ").length <= MOST_WORDS_IN_A_YIELD) yields.push(stated);
  });
  return {
    prepMinutes: theOnlyValue(times.prepMinutes),
    cookMinutes: theOnlyValue(times.cookMinutes),
    totalMinutes: theOnlyValue(times.totalMinutes),
    yield: theOnlyValue(yields),
  };
}
