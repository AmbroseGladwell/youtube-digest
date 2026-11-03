const UNIT_NAME: Record<string, [string, string]> = {
  tsp: ["teaspoon", "teaspoons"],
  tsps: ["teaspoon", "teaspoons"],
  tbsp: ["tablespoon", "tablespoons"],
  tbsps: ["tablespoon", "tablespoons"],
  tbs: ["tablespoon", "tablespoons"],
  tbls: ["tablespoon", "tablespoons"],
  tblsp: ["tablespoon", "tablespoons"],
  ml: ["millilitre", "millilitres"],
  mls: ["millilitre", "millilitres"],
  cl: ["centilitre", "centilitres"],
  dl: ["decilitre", "decilitres"],
  l: ["litre", "litres"],
  ltr: ["litre", "litres"],
  ltrs: ["litre", "litres"],
  g: ["gram", "grams"],
  gr: ["gram", "grams"],
  gm: ["gram", "grams"],
  gms: ["gram", "grams"],
  kg: ["kilogram", "kilograms"],
  kgs: ["kilogram", "kilograms"],
  mg: ["milligram", "milligrams"],
  oz: ["ounce", "ounces"],
  "fl oz": ["fluid ounce", "fluid ounces"],
  "fl. oz": ["fluid ounce", "fluid ounces"],
  lb: ["pound", "pounds"],
  lbs: ["pound", "pounds"],
  pt: ["pint", "pints"],
  qt: ["quart", "quarts"],
  gal: ["gallon", "gallons"],
  cm: ["centimetre", "centimetres"],
  mm: ["millimetre", "millimetres"],
  min: ["minute", "minutes"],
  mins: ["minute", "minutes"],
  hr: ["hour", "hours"],
  hrs: ["hour", "hours"],
  sec: ["second", "seconds"],
  secs: ["second", "seconds"],
};

const LENGTHS = new Set(["cm", "mm"]);

// What a size is said before when it describes the thing rather than counts it: "a 400 gram tin".
const CONTAINERS =
  /^(?:tins?|cans?|packs?|packets?|jars?|bags?|tubs?|pots?|cartons?|bottles?|blocks?|bars?|sachets?|boxe?s?|punnets?|pieces?|chunks?|cubes?|slices?|lengths?|pans?|dish(?:es)?|trays?|moulds?|rings?|loaf|skillets?|ramekins?)$/i;
const MEASURED_ALONG = /^(?:thick|wide|long|deep|high|tall|apart|across|in|of|or|and|to)$/i;

const UNICODE_FRACTION: Record<string, [number, number]> = {
  "½": [1, 2],
  "⅓": [1, 3],
  "⅔": [2, 3],
  "¼": [1, 4],
  "¾": [3, 4],
  "⅕": [1, 5],
  "⅙": [1, 6],
  "⅛": [1, 8],
  "⅜": [3, 8],
  "⅝": [5, 8],
  "⅞": [7, 8],
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTION).join("");
const PART_NAME: Record<number, string> = { 3: "third", 4: "quarter", 5: "fifth", 6: "sixth", 8: "eighth" };
const COUNT_NAME = ["", "one", "two", "three", "four", "five", "six", "seven"];

const AMOUNT = `(?:\\d+\\s?[${FRACTION_CHARS}]|\\d+\\s\\d\\/\\d{1,2}|[${FRACTION_CHARS}]|\\d\\/\\d{1,2}|\\d+(?:[.,]\\d+)?)`;
const UNIT = Object.keys(UNIT_NAME)
  .sort((a, b) => b.length - a.length)
  .map((unit) => unit.replace(/[.\s]/g, (char) => (char === "." ? "\\.?" : "\\s?")))
  .join("|");
const MEASURE = new RegExp(
  `(?<![\\p{L}\\d.,])(${AMOUNT})(?:\\s?(?:-|–|to)\\s?(${AMOUNT}))?\\s?(${UNIT})(?:\\.(?=\\s[\\p{Ll}\\d]))?(?![\\p{L}\\d])(?=(\\s+[\\p{L}]+)?)`,
  "giu",
);

interface Fraction {
  whole: number | null;
  parts: [number, number] | null;
  plain: string;
}

const readAmount = (amount: string): Fraction => {
  const mixed = amount.match(new RegExp(`^(\\d+)?\\s?(?:([${FRACTION_CHARS}])|(\\d)\\/(\\d{1,2}))$`, "u"));
  if (mixed === null) return { whole: null, parts: null, plain: amount };
  const parts: [number, number] = mixed[2] ? UNICODE_FRACTION[mixed[2]]! : [Number(mixed[3]), Number(mixed[4])];
  const named = parts[0] < parts[1] && (parts[1] === 2 || PART_NAME[parts[1]] !== undefined);
  return named ? { whole: mixed[1] === undefined ? null : Number(mixed[1]), parts, plain: amount } : { whole: null, parts: null, plain: amount };
};

const partWords = ([count, of]: [number, number]) =>
  of === 2 ? "a half" : count === 1 ? `a ${PART_NAME[of]}` : `${COUNT_NAME[count]} ${PART_NAME[of]}s`;

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

const amountWords = ({ whole, parts, plain }: Fraction) =>
  parts === null ? plain : whole === null ? partWords(parts).replace(/^a /, "") : `${whole} and ${partWords(parts)}`;

const isOne = ({ whole, parts, plain }: Fraction) => (parts === null ? plain === "1" : whole === null);

// The unit after an amount, said in full for the narration: "½ tsp" is "half a teaspoon",
// "2-3 tbsp" is "2 to 3 tablespoons", "400g tin" is "400 gram tin". The screen keeps the
// page's own text (docs/features/recipe-notes.md, "Reading aloud").
const measure = (_: string, from: string, to: string | undefined, unit: string, next: string | undefined) => {
  const key = unit.toLowerCase().replace(/\s+/g, " ").replace(/^fl ?\.? ?oz$/, "fl oz");
  const [one, many] = UNIT_NAME[key]!;
  const first = readAmount(from);
  const nextWord = next?.trim() ?? "";
  const describes = LENGTHS.has(key) ? nextWord !== "" && !MEASURED_ALONG.test(nextWord) : CONTAINERS.test(nextWord);
  if (to !== undefined) {
    return `${amountWords(first)} to ${amountWords(readAmount(to))} ${describes ? one : many}`;
  }
  if (first.parts !== null && first.whole === null && !describes) {
    return first.parts[1] === 2 ? `half ${article(one)} ${one}` : `${partWords(first.parts)} of ${article(one)} ${one}`;
  }
  return `${amountWords(first)} ${describes || isOne(first) ? one : many}`;
};

const temperature = (_: string, degrees: string, scale: string | undefined) =>
  `${degrees} degrees${scale === undefined ? "" : scale.toUpperCase() === "C" ? " Celsius" : " Fahrenheit"}`;

const lonePart = (_: string, whole: string | undefined, char: string) => {
  const words = partWords(UNICODE_FRACTION[char]!);
  return whole === undefined ? words.replace(/^a /, "") : `${whole} and ${words}`;
};

export function spokenMeasures(text: string): string {
  return text
    .replace(/\s+\([^()]*\)/g, "")
    .replace(/(?<![\p{L}\d.])(\d+)(?:\s?°\s?([CF])|\s?º\s?([CF])|([CF]))(?![\p{L}\d])/gu, (whole, degrees, a, b, c) =>
      temperature(whole, degrees, a ?? b ?? c),
    )
    .replace(/(?<![\p{L}\d.])(\d+)\s?[°º]/gu, (whole, degrees) => temperature(whole, degrees, undefined))
    .replace(/\b[Gg]as\s(?:[Mm]ark\s)?(\d)/g, "gas mark $1")
    .replace(MEASURE, measure)
    .replace(new RegExp(`(?<![\\p{L}\\d])(\\d+)?\\s?([${FRACTION_CHARS}])`, "gu"), lonePart)
    .replace(/(\p{L})\s?\/\s?(?=\d|gas\b)/gu, "$1, or ")
    .replace(/\s\+\s/g, " plus ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
