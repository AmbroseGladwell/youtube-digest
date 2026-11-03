import type { Recipe, RecipeStep } from "@overview/domain";
import { isObject, linkedData, typesOf, type JsonObject } from "./linkedData.js";

const inertBody = (document: Document, html: string): HTMLElement => {
  const { body } = document.implementation.createHTMLDocument("");
  body.innerHTML = html;
  return body;
};

const tidied = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();

const plainText = (document: Document, value: string): string => tidied(inertBody(document, value).textContent);

const stepsWritten = (document: Document, written: string): string[] => {
  const body = inertBody(document, written);
  const blocks = [...body.querySelectorAll("li, p")].map(({ textContent }) => textContent);
  return (blocks.length > 0 ? blocks : (body.textContent ?? "").split(/\n+/)).map(tidied).filter((step) => step !== "");
};

const methodSteps = (document: Document, value: unknown, group: string | null): RecipeStep[] => {
  if (typeof value === "string") return stepsWritten(document, value).map((text) => ({ text, group }));
  if (Array.isArray(value)) return value.flatMap((entry) => methodSteps(document, entry, group));
  if (!isObject(value) || typesOf(value).includes("HowToTip")) return [];
  if (value.itemListElement !== undefined) {
    const isSection = typesOf(value).includes("HowToSection") && typeof value.name === "string";
    return methodSteps(document, value.itemListElement, isSection ? plainText(document, value.name as string) || group : group);
  }
  return methodSteps(document, value.text ?? value.name, group);
};

const ingredientsOf = (document: Document, node: JsonObject): string[] => {
  const listed = node.recipeIngredient ?? node.ingredients;
  return (Array.isArray(listed) ? listed : [listed])
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => plainText(document, entry))
    .filter((entry) => entry !== "");
};

const MINUTES_IN_A_DAY = 24 * 60;

const minutesIn = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const parts = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i.exec(value.trim());
  if (parts === null) return null;
  const [, days = "0", hours = "0", minutes = "0"] = parts;
  return Number(days) * MINUTES_IN_A_DAY + Number(hours) * 60 + Number(minutes) || null;
};

const yieldOf = (document: Document, value: unknown): string | null => {
  const stated = (Array.isArray(value) ? value : [value])
    .filter((entry): entry is string | number => typeof entry === "string" || typeof entry === "number")
    .map((entry) => plainText(document, String(entry)))
    .filter((entry) => entry !== "");
  return stated.find((entry) => /\p{L}/u.test(entry)) ?? stated[0] ?? null;
};

const recipeFrom = (document: Document, node: JsonObject): Recipe | null => {
  const ingredients = ingredientsOf(document, node);
  const steps = methodSteps(document, node.recipeInstructions, null);
  if (ingredients.length === 0 || steps.length === 0) return null;
  return {
    ingredients,
    steps,
    prepMinutes: minutesIn(node.prepTime),
    cookMinutes: minutesIn(node.cookTime),
    totalMinutes: minutesIn(node.totalTime),
    yield: yieldOf(document, node.recipeYield),
  };
};

const isHidden = ({ isAccessibleForFree: free }: JsonObject): boolean =>
  free === false || (typeof free === "string" && free.toLowerCase() === "false");

// One page, one recipe: a page declaring several is a round-up, and reads as an article
// (docs/features/recipe-notes.md).
export function pageRecipe(document: Document): Recipe | null {
  const declared = linkedData(document)
    .flatMap((node) => [node, ...(isObject(node.mainEntity) ? [node.mainEntity] : [])])
    .filter((node) => typesOf(node).includes("Recipe") && !isHidden(node));
  const usable = declared.flatMap((node) => {
    const recipe = recipeFrom(document, node);
    return recipe === null ? [] : [{ name: node.name, recipe }];
  });
  const [first] = usable;
  if (first === undefined || usable.some(({ name }) => name !== first.name)) return null;
  return first.recipe;
}
