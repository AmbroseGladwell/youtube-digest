// What one US cup of a dry ingredient weighs, from King Arthur's ingredient weight chart, so
// Metric can say "120g plain flour" where the page says "1 cup". Only ingredients a table can
// answer for: rice flour, chickpea flour or "1 cup sugar snap peas" find nothing and stay in ml.
const WEIGHTS: Array<[RegExp, number]> = [
  [/\bself[- ]?(?:raising|rising)\b.*\bflour\b/, 113],
  [/\b(?:almond (?:flour|meal)|ground almonds)\b/, 96],
  [/\b(?:whole ?wheat|wholemeal)\b.*\bflour\b/, 113],
  [/\b(?:cornflour|cornstarch|corn starch)\b/, 112],
  [/(?:^|\b(?:plain|all[- ]?purpose|bread|cake|pastry|white)\b.*\b)flour\b/, 120],
  [/^(?:unsweetened )?cocoa(?: powder)?\b/, 84],
  [/\b(?:icing|powdered|confectioners[’']?) sugar\b/, 113],
  [/\b(?:light |dark )?(?:brown sugar|muscovado)\b/, 213],
  [/\b(?:caster|superfine)\b.*\bsugar\b/, 190],
  [/(?:^|\bgranulated |\bwhite )sugar\b(?! snap)/, 198],
  [/^(?:(?:unsalted|salted|softened|cold|melted|chilled)\s+)*butter\b/, 227],
  [/\b(?:rolled|porridge|old[- ]fashioned)? ?oats\b/, 89],
  [/\bchocolate chips\b/, 170],
];

export function gramsPerCup(ingredient: string): number | null {
  const name = ingredient
    .split(/[,(;]/)[0]!
    .trim()
    .toLowerCase()
    .replace(/^of\s+/, "");
  return WEIGHTS.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}
