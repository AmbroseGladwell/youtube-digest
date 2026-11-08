export type RecipeUnits = "asWritten" | "metric" | "us";

export interface IngredientPiece {
  text: string;
  changed: boolean;
}

export type AdjustedIngredient =
  | { kind: "asWritten"; line: string }
  // Read, but nothing about it moved: a 1× line, or one already in the units asked for.
  | { kind: "same"; line: string }
  // `written` is the amount as the page gave it, and `plural` the noun that took its plural, so
  // the method can find the same amount and say it the same way (OV-231).
  | { kind: "adjusted"; pieces: IngredientPiece[]; packAsSold: boolean; written: string; plural: { from: string; to: string } | null }
  // No amount we can read, or more than one, so it stays exactly as the page wrote it.
  | { kind: "unreadable"; line: string };

type Kind = "weight" | "volume";

interface Unit {
  kind: Kind;
  // In grams or millilitres.
  size: number;
  system: "metric" | "us" | "both";
  singular: string;
  plural: string;
}

const UNITS: Record<string, Unit> = {
  mg: { kind: "weight", size: 0.001, system: "metric", singular: "mg", plural: "mg" },
  g: { kind: "weight", size: 1, system: "metric", singular: "g", plural: "g" },
  kg: { kind: "weight", size: 1000, system: "metric", singular: "kg", plural: "kg" },
  oz: { kind: "weight", size: 28.3495, system: "us", singular: "oz", plural: "oz" },
  lb: { kind: "weight", size: 453.592, system: "us", singular: "lb", plural: "lb" },
  ml: { kind: "volume", size: 1, system: "metric", singular: "ml", plural: "ml" },
  l: { kind: "volume", size: 1000, system: "metric", singular: "litre", plural: "litres" },
  tsp: { kind: "volume", size: 4.92892, system: "both", singular: "tsp", plural: "tsp" },
  tbsp: { kind: "volume", size: 14.7868, system: "both", singular: "tbsp", plural: "tbsp" },
  floz: { kind: "volume", size: 29.5735, system: "us", singular: "fl oz", plural: "fl oz" },
  cup: { kind: "volume", size: 236.588, system: "us", singular: "cup", plural: "cups" },
};

const UNIT_WORDS: Array<[RegExp, keyof typeof UNITS]> = [
  [/^(?:mg|milligrams?)\b/i, "mg"],
  [/^(?:kg|kilos?|kilograms?)\b/i, "kg"],
  [/^(?:g|grams?|gr)\b/i, "g"],
  [/^(?:oz|ounces?)\b/i, "oz"],
  [/^(?:lbs?|pounds?)\b/i, "lb"],
  [/^(?:ml|millilitres?|milliliters?)\b/i, "ml"],
  [/^(?:l|litres?|liters?)\b/i, "l"],
  [/^(?:tsps?|teaspoons?)\b/i, "tsp"],
  [/^(?:tbsps?|tbs|tablespoons?)\b/i, "tbsp"],
  [/^(?:fl\.? ?oz|fluid ounces?)\b/i, "floz"],
  [/^(?:cups?)\b/i, "cup"],
];

const VULGAR: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const VULGAR_CLASS = "¼½¾⅓⅔⅛";
const NUMBER = `(?:\\d+(?:\\s+|-)\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*[${VULGAR_CLASS}])?|[${VULGAR_CLASS}])`;
const AMOUNT = new RegExp(`^(${NUMBER})(?:\\s*[-–]\\s*(${NUMBER}))?`);
const PACK = new RegExp(`^\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*([a-z]+)\\b`, "i");
const ANY_NUMBER = new RegExp(`\\d|[${VULGAR_CLASS}]`);
const PACK_WORDS = "tins?|cans?|packs?|packets?|jars?|bags?|bottles?|cartons?|blocks?|sachets?|pots?|tubs?";
const PACK_WORD = new RegExp(`^\\s*(?:${PACK_WORDS})\\b`, "i");
const LEADING_PACK_WORD = new RegExp(`^(\\s*)(${PACK_WORDS})\\b`, "i");
// "1 small tub (200g)": the bracket is the tub's size as sold, not a second amount.
const PACK_SIZE = new RegExp(`\\b(?:${PACK_WORDS})\\s*\\(\\s*${NUMBER}\\s*[a-z]*\\s*\\)`, "i");
const LEAD_IN = /^((?:the\s+)?(?:juice|zest|zest and juice|juice and zest|seeds|leaves)\s+of\s+)/i;

const parseNumber = (text: string): number => {
  const trimmed = text.trim();
  const vulgarTail = trimmed.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)?\\s*([${VULGAR_CLASS}])$`));
  if (vulgarTail) return Number((vulgarTail[1] ?? "0").replace(",", ".")) + VULGAR[vulgarTail[2]!]!;
  const mixed = trimmed.match(/^(\d+)(?:\s+|-)(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(trimmed.replace(",", "."));
};

const FRACTIONS: Array<[number, string]> = [
  [0, ""],
  [0.125, "⅛"],
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
  [1, ""],
];

// Counts and spoons read best as kitchen fractions; grams and millilitres as whole numbers.
const formatNumber = (value: number, unit: Unit | null): string => {
  if (unit !== null && unit.system === "metric" && unit.size <= 1) {
    const rounded = value >= 100 ? Math.round(value / 5) * 5 : value >= 10 ? Math.round(value) : Math.round(value * 2) / 2;
    return String(rounded);
  }
  if (unit !== null && unit.system === "metric") {
    return String(Math.round(value * 100) / 100);
  }
  const whole = Math.floor(value);
  const rest = value - whole;
  let best = FRACTIONS[0]!;
  for (const fraction of FRACTIONS) {
    if (Math.abs(fraction[0] - rest) < Math.abs(best[0] - rest)) best = fraction;
  }
  const total = best[0] === 1 ? whole + 1 : whole;
  if (total === 0 && best[1] === "") return value >= 1 ? String(Math.round(value)) : "⅛";
  return `${total === 0 ? "" : total}${best[1]}`;
};

const SPOON_MEASURE = /^(?:heaped|level|rounded)\s+/i;

const unitNamed = (text: string): { unit: keyof typeof UNITS; length: number } | null => {
  const measure = text.match(SPOON_MEASURE)?.[0] ?? "";
  for (const [pattern, unit] of UNIT_WORDS) {
    const match = text.slice(measure.length).match(pattern);
    if (match && (measure === "" || UNITS[unit]!.system === "both")) return { unit, length: measure.length + match[0].length };
  }
  return null;
};

const IRREGULAR: Record<string, string> = { leaf: "leaves", loaf: "loaves", half: "halves", knife: "knives", chilli: "chillies" };

const plural = (word: string): string => {
  const lower = word.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower]!;
  if (/s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:ch|sh|x|z|tomato|potato|mango)$/i.test(word)) return `${word}es`;
  return `${word}s`;
};

const PREPARED_HOW = /^(?:finely|roughly|thinly|thickly|coarsely|lightly|freshly|very|well)$/i;
const PREPARED = /^[a-z]{3,}ed$/i;

// "1 small garlic clove, grated" doubled is "2 small garlic cloves, grated": the noun is the
// last word before the first comma or bracket, or before how it's prepared where there's no
// comma ("1 onion finely chopped"). A noun we can't find stays singular rather than a guess.
const pluralised = (rest: string): string => {
  const end = rest.search(/[,(;]/);
  const head = end === -1 ? rest : rest.slice(0, end);
  const words = [...head.matchAll(/\S+/g)];
  const prepared = words.findIndex(
    ([word], index) =>
      index > 0 &&
      (PREPARED_HOW.test(word) || (PREPARED.test(word) && (index === words.length - 1 || /^(?:and|or|then)$/i.test(words[index + 1]![0])))),
  );
  const noun = words[prepared === -1 ? words.length - 1 : prepared - 1];
  if (noun === undefined || !/^[a-z]+$/i.test(noun[0])) return rest;
  const at = noun.index!;
  return `${rest.slice(0, at)}${plural(noun[0])}${rest.slice(at + noun[0].length)}`;
};

// "1½ cups", "1 cup": a unit written as a word agrees with its new amount; "tbsp" and "g" don't change.
const agreeing = (unitText: string, many: boolean): string => {
  const word = unitText.match(/[a-z]+$/i)?.[0] ?? "";
  if (!/^[a-z]{3,}$/i.test(word) || /^(?:tsps?|tbsps?|tbs|lbs?|kg)$/i.test(word)) return unitText;
  const space = unitText.slice(0, unitText.length - word.length);
  if (many) return space + plural(word);
  return space + (/s$/i.test(word) ? word.slice(0, -1) : word);
};

const target = (unit: Unit, grams: number, units: RecipeUnits): Unit => {
  if (units === "asWritten" || unit.system === "both" || unit.system === units) return unit;
  if (unit.kind === "weight") {
    if (units === "metric") return grams >= 1000 ? UNITS.kg! : UNITS.g!;
    return grams >= UNITS.lb!.size ? UNITS.lb! : UNITS.oz!;
  }
  if (units === "metric") return grams >= 1000 ? UNITS.l! : UNITS.ml!;
  if (grams >= UNITS.cup!.size / 4) return UNITS.cup!;
  return grams >= UNITS.tbsp!.size ? UNITS.tbsp! : UNITS.tsp!;
};

// Arithmetic on an amount we can read at the start of a line, never a guess: units move
// only within their kind, a tin's size stays as sold, and anything else stays as written
// (design 144y–144ab, docs/features/recipe-notes.md).
export function adjustIngredient(line: string, factor: number, units: RecipeUnits): AdjustedIngredient {
  if (factor === 1 && units === "asWritten") return { kind: "asWritten", line };

  const lead = line.match(LEAD_IN)?.[1] ?? "";
  const body = line.slice(lead.length);
  const amount = body.match(AMOUNT);
  if (amount === null) return { kind: "unreadable", line };

  let rest = body.slice(amount[0].length);
  const low = parseNumber(amount[1]!);
  const high = amount[2] === undefined ? null : parseNumber(amount[2]);

  const pack = rest.match(PACK);
  let packText = "";
  if (pack !== null) {
    packText = pack[0];
    rest = rest.slice(pack[0].length);
  }

  const spaced = rest.match(/^\s*/)![0];
  const named = pack === null ? unitNamed(rest.slice(spaced.length)) : null;
  if (named === null && pack === null && PACK_WORD.test(rest)) return { kind: "unreadable", line };
  const afterUnit = named === null ? rest : rest.slice(spaced.length + named.length);
  if (named !== null && PACK_WORD.test(afterUnit)) {
    return high === null ? packsOf(line, lead, `${amount[0]}${rest.slice(0, spaced.length + named.length)}`, afterUnit, factor) : { kind: "unreadable", line };
  }
  const packSized = named === null && pack === null && PACK_SIZE.test(afterUnit);
  if (ANY_NUMBER.test(packSized ? afterUnit.replace(PACK_SIZE, "") : afterUnit)) return { kind: "unreadable", line };

  const from = named === null ? null : UNITS[named.unit]!;
  const to = from === null ? null : target(from, low * factor * from.size, units);
  const convert = (value: number) => (from === null || to === null ? value * factor : (value * factor * from.size) / to.size);
  const newLow = convert(low);
  const newHigh = high === null ? null : convert(high);
  const amountText = `${formatNumber(newLow, to)}${newHigh === null ? "" : `–${formatNumber(newHigh, to)}`}`;
  const unitUnchanged = from === to;
  const many = newLow > 1 || newHigh !== null;
  const unitShown =
    named === null || to === null
      ? ""
      : unitUnchanged
        ? agreeing(rest.slice(0, spaced.length + named.length), many)
        : `${to.system === "metric" && to !== UNITS.l ? "" : " "}${many ? to.plural : to.singular}`;
  const moved = Math.abs(newLow - low) > 1e-9 || !unitUnchanged || (high !== null && Math.abs((newHigh ?? 0) - high) > 1e-9);
  if (!moved) return { kind: "same", line };

  const tail = from === null && pack === null && low <= 1 && newLow > 1 && high === null ? pluralised(afterUnit) : afterUnit;
  const pieces: IngredientPiece[] = [
    { text: lead, changed: false },
    { text: `${amountText}${unitShown}`, changed: true },
    { text: packText, changed: false },
    { text: tail, changed: false },
  ].filter(({ text }) => text !== "");
  const written = `${amount[0]}${named === null ? "" : rest.slice(0, spaced.length + named.length)}`;
  return { kind: "adjusted", pieces, packAsSold: pack !== null || packSized, written, plural: pluralTaken(afterUnit, tail) };
}

const pluralTaken = (before: string, after: string): { from: string; to: string } | null => {
  if (before === after) return null;
  const was = before.split(/\s+/);
  const now = after.split(/\s+/);
  const at = was.findIndex((word, index) => word !== now[index]);
  return at === -1 ? null : { from: was[at]!.replace(/[^a-z]/gi, ""), to: now[at]!.replace(/[^a-z]/gi, "") };
};

// "400g can chopped tomatoes" doubled is "2 × 400g cans chopped tomatoes": the can is sold at
// its size, so what scales is how many of them, written the way "2 × 400g tins" already is.
function packsOf(line: string, lead: string, size: string, afterSize: string, factor: number): AdjustedIngredient {
  if (ANY_NUMBER.test(afterSize)) return { kind: "unreadable", line };
  if (factor === 1) return { kind: "same", line };
  const word = afterSize.match(LEADING_PACK_WORD)!;
  const tail = afterSize.slice(word[0].length);
  const singular = word[2]!.replace(/s$/i, "");
  const pieces: IngredientPiece[] = [
    { text: lead, changed: false },
    { text: formatNumber(factor, null), changed: true },
    { text: ` × ${size}`, changed: false },
    { text: `${word[1]}${factor > 1 ? plural(singular) : singular}${tail}`, changed: false },
  ].filter(({ text }) => text !== "");
  return { kind: "adjusted", pieces, packAsSold: true, written: size, plural: null };
}

export const adjustedText = (adjusted: AdjustedIngredient): string =>
  adjusted.kind === "adjusted" ? adjusted.pieces.map(({ text }) => text).join("") : adjusted.line;

// The number at the front of a yield, "4" of "4 servings", that servings step from. Null
// where there isn't one, and the reader gets a multiplier instead (design 144aa).
export function yieldCount(yieldText: string | null): number | null {
  const match = yieldText?.match(/^\D{0,20}?(\d+)(?!\s*[-–]\s*\d)/);
  if (!match) return null;
  const count = Number(match[1]);
  return count > 0 ? count : null;
}

// "8 servings" for "4 servings" doubled; a bare "6" reads "Makes 12".
export function servingsLabel(yieldText: string, count: number): string {
  if (!/[a-z]/i.test(yieldText)) return `Makes ${count}`;
  return yieldText.replace(/\d+/, String(count));
}
