import type { Recipe } from "./Recipe.js";

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

const minutesIn = (written: string): number | null => {
  const parts = DURATION.exec(written.trim());
  if (parts === null || (parts[1] === undefined && parts[2] === undefined)) return null;
  return Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0) || null;
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

// The times and yield a source labels as text, a recipe page's or a video's description, read in
// code and never worked out (docs/features/recipe-notes.md, "Read from the page itself").
export function recipeFactsInLines(lines: readonly string[]): Facts {
  const times: Record<Time, number[]> = { prepMinutes: [], cookMinutes: [], totalMinutes: [] };
  const yields: string[] = [];
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
