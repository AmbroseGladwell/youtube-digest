const VULGAR: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const VULGAR_CLASS = "¼½¾⅓⅔⅛";
const NUMBER = `(?:\\d+(?:\\s+|-)\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?:\\s*[${VULGAR_CLASS}])?|[${VULGAR_CLASS}])`;
const DIGITS = new RegExp(`${NUMBER}(\\s+and\\s+a\\s+half)?`, "g");

const UNITS_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS_WORDS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const FRACTION_WORDS: Record<string, number> = { half: 0.5, halves: 0.5, quarter: 0.25, quarters: 0.25, third: 1 / 3, thirds: 1 / 3 };
const WORD = new RegExp(
  `\\b(?:(${Object.keys(TENS_WORDS).join("|")})(?:[\\s-]+(${Object.keys(UNITS_WORDS).join("|")}))?|(${Object.keys(UNITS_WORDS).join("|")})|(a\\s+)?dozen|hundred)` +
    `(?:\\s+(${Object.keys(FRACTION_WORDS).join("|")})|(\\s+and\\s+a\\s+half))?\\b|\\b(?:a\\s+|an\\s+)?(half|quarter|third)\\b`,
  "gi",
);

const UNIT = "cups?|tbsps?|tbs|tablespoons?|tsps?|teaspoons?|g|grams?|kg|kilos?|kilograms?|mg|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lbs?|pounds?|pinch(?:es)?|handfuls?|dash(?:es)?";
const LEADING_AMOUNT = new RegExp(
  `^\\s*(?:about|approx\\.?|roughly|around)?\\s*${NUMBER}(?:\\s*[-–]\\s*${NUMBER})?\\s*(?:[x×]\\s*)?(?:(?:${UNIT})\\b\\.?\\s*)?(?:of\\s+)?`,
  "i",
);
const BRACKETED = /\s*\([^)]*\)/g;

const parseDigits = (text: string): number => {
  const trimmed = text.trim();
  const vulgarTail = trimmed.match(new RegExp(`^(\\d+(?:\\.\\d+)?)?\\s*([${VULGAR_CLASS}])$`));
  if (vulgarTail) return Number(vulgarTail[1] ?? 0) + VULGAR[vulgarTail[2]!]!;
  const mixed = trimmed.match(/^(\d+)(?:\s+|-)(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(trimmed);
};

// Every number a text states, in digits or in words, so "two and a half cups" and "2½ cups" state
// the same amount. Read in code, never by a model (docs/prototype/constraints.md).
export function numbersStated(text: string): number[] {
  const found: number[] = [];
  for (const match of text.matchAll(DIGITS)) {
    const value = parseDigits(match[0].replace(/\s+and\s+a\s+half$/i, ""));
    found.push(match[1] === undefined ? value : value + 0.5);
  }
  for (const match of text.matchAll(WORD)) {
    const [, tens, tensUnit, unit, dozenArticle, fraction, andAHalf, lone] = match;
    if (lone !== undefined) {
      found.push(FRACTION_WORDS[lone.toLowerCase()]!);
      continue;
    }
    const whole =
      tens !== undefined
        ? TENS_WORDS[tens.toLowerCase()]! + (tensUnit === undefined ? 0 : UNITS_WORDS[tensUnit.toLowerCase()]!)
        : unit !== undefined
          ? UNITS_WORDS[unit.toLowerCase()]!
          : match[0].toLowerCase().includes("dozen") || dozenArticle !== undefined
            ? 12
            : 100;
    if (fraction !== undefined) found.push(whole * FRACTION_WORDS[fraction.toLowerCase()]!);
    else found.push(andAHalf === undefined ? whole : whole + 0.5);
  }
  return found;
}

const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export interface StatedNumbers {
  has: (value: number) => boolean;
}

export const statedNumbersIn = (sources: readonly string[]): StatedNumbers => {
  const values = sources.flatMap(numbersStated);
  return { has: (value) => values.some((stated) => sameNumber(stated, value)) };
};

const unstatedIn = (text: string, stated: StatedNumbers): number => numbersStated(text).filter((value) => !stated.has(value)).length;

// A line whose amount nobody stated keeps its name and loses the amount: "1 tsp salt" becomes
// "salt" (docs/features/recipe-notes.md, "Recipe videos").
export function withStatedAmounts(lines: readonly string[], stated: StatedNumbers): { ingredients: string[]; amountsDropped: number } {
  let amountsDropped = 0;
  const ingredients = lines.flatMap((line) => {
    if (unstatedIn(line, stated) === 0) return [line];
    amountsDropped += 1;
    let kept = line.replace(BRACKETED, (bracket) => (unstatedIn(bracket, stated) > 0 ? "" : bracket));
    for (let tries = 0; tries < 2; tries += 1) {
      const leading = LEADING_AMOUNT.exec(kept)?.[0] ?? "";
      if (unstatedIn(leading, stated) === 0) break;
      kept = kept.slice(leading.length);
    }
    if (unstatedIn(kept, stated) > 0) {
      kept = kept
        .split(",")
        .filter((part) => unstatedIn(part, stated) === 0)
        .join(",");
    }
    kept = kept.trim();
    return kept === "" ? [] : [kept];
  });
  return { ingredients, amountsDropped };
}
