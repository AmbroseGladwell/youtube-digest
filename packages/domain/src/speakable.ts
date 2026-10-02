const CURRENCY_NAME: Record<string, [string, string]> = {
  $: ["dollar", "dollars"],
  "£": ["pound", "pounds"],
  "€": ["euro", "euros"],
};

const MAGNITUDE_NAME: Record<string, string> = { k: "thousand", m: "million", bn: "billion" };

const NUMBER_NAME = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const FRACTION_NAME: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["quarter", "quarters"],
  5: ["fifth", "fifths"],
  6: ["sixth", "sixths"],
  7: ["seventh", "sevenths"],
  8: ["eighth", "eighths"],
  9: ["ninth", "ninths"],
  10: ["tenth", "tenths"],
};

const money = (
  _: string,
  article: string | undefined,
  symbol: string,
  amount: string,
  magnitude: string | undefined,
) => {
  const [one, many] = CURRENCY_NAME[symbol]!;
  const scale = magnitude ? ` ${MAGNITUDE_NAME[magnitude.toLowerCase()]}` : "";
  const unit = article || (amount === "1" && !magnitude) ? one : many;
  return `${article ?? ""}${amount}${scale} ${unit}`;
};

const fraction = (whole: string, numerator: string, denominator: string) => {
  const names = FRACTION_NAME[Number(denominator)];
  const count = Number(numerator);
  if (!names || count < 1 || count >= Number(denominator)) {
    return whole;
  }
  return `${NUMBER_NAME[count]} ${count === 1 ? names[0] : names[1]}`;
};

export function speakable(text: string): string {
  return text
    .replace(/\s+\([^()]*\)/g, "")
    .replace(/\b401\s?\(?k\)?/gi, "four oh one k")
    .replace(/\be\.g\.,?/gi, "for example")
    .replace(/\bi\.e\.,?/gi, "that is")
    .replace(/\betc\./gi, "and so on")
    .replace(/\bvs\b\.?/gi, "versus")
    .replace(/\s&\s/g, " and ")
    .replace(/(\b[Aa]n? )?([$£€])(\d[\d,]*(?:\.\d+)?)(k|m|bn)?\b/gi, money)
    .replace(/\b(\d+(?:\.\d+)?)k\b/g, "$1 thousand")
    .replace(/(\d)\s?%/g, "$1 percent")
    .replace(/(\d)\s?[x×]\s?(?=\d)/g, "$1 times ")
    .replace(/\s?\^\s?-/g, " to the power of minus ")
    .replace(/\s?\^\s?/g, " to the power of ")
    .replace(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g, fraction)
    .replace(/\s{2,}/g, " ")
    .trim();
}
