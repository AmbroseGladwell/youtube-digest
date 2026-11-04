import type { Recipe, RecipeStep } from "@overview/domain";

type Part = "ingredients" | "method";
type Section = { part: Part; heading: Element; items: RecipeStep[] };

const INGREDIENTS_HEADING = /^(the )?(ingredients?|what you('ll| will)? need|you('ll| will)? need)$/;
const METHOD_HEADING = /^(the )?(method|instructions|directions|steps|preparation|how to make it)$/;
const OUTSIDE_THE_CONTENT =
  'nav, footer, aside, form, [hidden], [aria-hidden="true"], [role="navigation"], [role="complementary"], [role="contentinfo"], #comments, .comments, .comments-area, .comment, .comment-body, .comment-content';
const QUANTITY = /\d|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\b(pinch|handful|bunch|sprigs?|cloves?|knob|splash|dash|drizzle|cans?|tins?|tbsp|tsp|cups?|to taste|to serve)\b/i;
const FEWEST_WORDS_IN_A_STEP = 4;
const NUMBERED_STEP = /^step \d+$/i;
const SHOW_ELEMENTS = 1;

const tidied = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();

const levelOf = (element: Element): number | null => {
  const level = /^H([1-6])$/.exec(element.tagName)?.[1];
  return level === undefined ? null : Number(level);
};

const isOutsideTheContent = (element: Element): boolean => element.closest(OUTSIDE_THE_CONTENT) !== null;

const isLink = (heading: Element): boolean => {
  const linked = [...heading.querySelectorAll("a")].map(({ textContent }) => tidied(textContent)).join(" ");
  return linked !== "" && linked === tidied(heading.textContent);
};

const partNamed = (heading: Element): Part | null => {
  if (isLink(heading) || isOutsideTheContent(heading)) return null;
  const name = tidied(heading.textContent).toLowerCase().replace(/[:.]$/, "");
  if (INGREDIENTS_HEADING.test(name)) return "ingredients";
  if (METHOD_HEADING.test(name)) return "method";
  return null;
};

const isList = (element: Element): boolean => element.tagName === "UL" || element.tagName === "OL";

const containerOf = (heading: Element): Element => {
  const headingText = tidied(heading.textContent);
  let container = heading.parentElement!;
  while (tidied(container.textContent) === headingText && container.parentElement !== null) container = container.parentElement;
  return container;
};

const sectionUnder = (document: Document, heading: Element, part: Part): Section => {
  const level = levelOf(heading)!;
  const walker = document.createTreeWalker(containerOf(heading), SHOW_ELEMENTS);
  walker.currentNode = heading;
  const listed: RecipeStep[] = [];
  const written: RecipeStep[] = [];
  let group: string | null = null;
  for (let node = walker.nextNode() as Element | null; node !== null; node = walker.nextNode() as Element | null) {
    if (heading.contains(node)) continue;
    if (isOutsideTheContent(node)) break;
    const nodeLevel = levelOf(node);
    if (nodeLevel !== null) {
      if (nodeLevel <= level || partNamed(node) !== null) break;
      const name = tidied(node.textContent);
      group = part === "method" && name !== "" && !NUMBERED_STEP.test(name) ? name : null;
      continue;
    }
    const text = tidied(node.textContent);
    if (text === "") continue;
    if (node.tagName === "LI" && ![...node.children].some(isList)) listed.push({ text, group });
    if (node.tagName === "P" && node.closest("li") === null) written.push({ text, group });
  }
  return { part, heading, items: listed.length > 0 || part === "ingredients" ? listed : written };
};

const holdsTogether = ({ part, items }: Section): boolean => {
  const fitting =
    part === "ingredients"
      ? items.filter(({ text }) => QUANTITY.test(text))
      : items.filter(({ text }) => text.split(" ").length >= FEWEST_WORDS_IN_A_STEP);
  return items.length > 0 && fitting.length * 2 >= items.length;
};

const sameItems = (a: Section, b: Section): boolean => JSON.stringify(a.items) === JSON.stringify(b.items);

const theOnly = (sections: Section[]): Section | null => {
  const [first] = sections;
  return first !== undefined && sections.every((section) => sameItems(section, first)) ? first : null;
};

// The recipe a page shows when it declares none: an ingredients heading over a list, and a
// method heading over steps (docs/features/recipe-notes.md, "Read from the page itself").
export function markupRecipe(document: Document): Recipe | null {
  if (document.body === null) return null;
  const sections = [...document.body.querySelectorAll("h1, h2, h3, h4, h5, h6")]
    .flatMap((heading) => {
      const part = partNamed(heading);
      return part === null ? [] : [sectionUnder(document, heading, part)];
    })
    .filter(holdsTogether);
  const ingredients = theOnly(sections.filter(({ part }) => part === "ingredients"));
  const method = theOnly(sections.filter(({ part }) => part === "method"));
  if (ingredients === null || method === null) return null;
  if (!(ingredients.heading.compareDocumentPosition(method.heading) & method.heading.DOCUMENT_POSITION_FOLLOWING)) return null;
  return {
    ingredients: ingredients.items.map(({ text }) => text),
    steps: method.items,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    yield: null,
  };
}
