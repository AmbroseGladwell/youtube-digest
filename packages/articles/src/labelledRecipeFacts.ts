import { recipeFactsInLines, type Recipe } from "@overview/domain";
import { isPageFurniture } from "./isPageFurniture.js";

type Facts = Pick<Recipe, "prepMinutes" | "cookMinutes" | "totalMinutes" | "yield">;
const INLINE = new Set([
  "A",
  "ABBR",
  "B",
  "BDI",
  "BDO",
  "CITE",
  "CODE",
  "DATA",
  "DFN",
  "EM",
  "FONT",
  "I",
  "KBD",
  "LABEL",
  "MARK",
  "Q",
  "S",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TIME",
  "U",
  "VAR",
]);
const UNREAD = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "SVG"]);
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const tidied = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();

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

// The times and yield a recipe read from markup labels as text, ahead of its method
// (docs/features/recipe-notes.md, "Read from the page itself").
export function labelledRecipeFacts(body: HTMLElement, method: Element): Facts {
  return recipeFactsInLines(linesBefore(body, method));
}
