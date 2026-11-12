export interface MethodTime {
  start: number;
  end: number;
  seconds: readonly number[];
  name: string | null;
}

const MOST_SECONDS = 24 * 60 * 60;
const FRACTION_VALUES: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const FRACTIONS = Object.keys(FRACTION_VALUES).join("");
const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  "twenty-five": 25,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  fifty: 50,
  sixty: 60,
  ninety: 90,
};
const UNIT_SECONDS = { hour: 3600, minute: 60, second: 1 } as const;
type Unit = keyof typeof UNIT_SECONDS;

const WORD_NUMBER = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const NUMBER = `(?:\\d+\\s+\\d\\/\\d|\\d+\\/\\d|\\d+(?:\\.\\d+)?\\s?[${FRACTIONS}]?|[${FRACTIONS}]|(?:${WORD_NUMBER})(?![\\p{L}-]))`;
const HALF = `(?:\\s+and\\s+a\\s+half)?`;
const UNIT = `(?:(?:\\s*|-)(hours?|hrs?|minutes?|mins?|seconds?|secs?)|(h|m|s))(?![\\p{L}])`;
const MORE = `(?:\\s+(?:more|further|extra))?`;
const LINK = `\\s*(?:-|–|—|to|or)\\s*`;
const SPAN = new RegExp(
  `(?<![\\p{L}\\d.,/${FRACTIONS}])(?:half\\s+an\\s+hour|(${NUMBER})(?:(${LINK})(${NUMBER}))?${HALF}${MORE}${UNIT})`,
  "giu",
);
const MINUTES_AFTER_HOURS = new RegExp(`^(\\s*(?:and\\s+)?)(${NUMBER})${UNIT}`, "iu");
const BARE_MINUTES_AFTER_HOURS = /^\s*(\d{1,2})(?=\s*(?:[,.;)]|$|\s(?:until|or|and|then)\b))/u;
const UPPER_END = new RegExp(`^${LINK}(${NUMBER})${HALF}${UNIT}`, "iu");
const NOT_A_WAIT = /\b(?:within|every|each)\s+(?:about\s+|roughly\s+|around\s+)?$/i;

const numberValue = (written: string): number => {
  const text = written.trim().toLowerCase();
  if (text in NUMBER_WORDS) return NUMBER_WORDS[text]!;
  const mixed = /^(\d+)\s+(\d)\/(\d)$/.exec(text);
  if (mixed !== null) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\/(\d)$/.exec(text);
  if (fraction !== null) return Number(fraction[1]) / Number(fraction[2]);
  const glyph = /^(\d+(?:\.\d+)?)?\s?([¼½¾⅓⅔])?$/u.exec(text);
  if (glyph === null) return Number.NaN;
  return (glyph[1] === undefined ? 0 : Number(glyph[1])) + (glyph[2] === undefined ? 0 : FRACTION_VALUES[glyph[2]]!);
};

const unitOf = (word: string): Unit => {
  const first = word.toLowerCase()[0];
  return first === "h" ? "hour" : first === "m" ? "minute" : "second";
};

const halfOf = (matched: string): number => (/and\s+a\s+half/i.test(matched) ? 0.5 : 0);

interface Found {
  start: number;
  end: number;
  seconds: number[];
  unit: Unit;
}

const read = (text: string, match: RegExpExecArray): Found | null => {
  const start = match.index;
  let end = start + match[0].length;
  if (/^half\s+an\s+hour$/i.test(match[0])) return { start, end, seconds: [1800], unit: "hour" };
  const unit = unitOf(match[4] ?? match[5]!);
  const half = halfOf(match[0]);
  const upper = match[3] === undefined ? null : numberValue(match[3]) + half;
  const lower = numberValue(match[1]!) + (upper === null ? half : 0);
  let seconds = (upper === null ? [lower] : [lower, upper]).map((value) => Math.round(value * UNIT_SECONDS[unit]));
  if (unit === "hour" && upper === null) {
    const rest = text.slice(end);
    const minutes = MINUTES_AFTER_HOURS.exec(rest);
    if (minutes !== null && unitOf(minutes[3] ?? minutes[4]!) === "minute") {
      seconds = [seconds[0]! + Math.round(numberValue(minutes[2]!) * 60)];
      end += minutes[0].length;
    } else {
      const bare = BARE_MINUTES_AFTER_HOURS.exec(rest);
      if (bare !== null && Number(bare[1]) < 60) {
        seconds = [seconds[0]! + Number(bare[1]) * 60];
        end += bare[0].length;
      }
    }
  }
  if (seconds.length === 1) {
    const upperEnd = UPPER_END.exec(text.slice(end));
    if (upperEnd !== null) {
      const second = Math.round((numberValue(upperEnd[1]!) + halfOf(upperEnd[0])) * UNIT_SECONDS[unitOf(upperEnd[2] ?? upperEnd[3]!)]);
      if (second > seconds[0]!) {
        seconds = [seconds[0]!, second];
        end += upperEnd[0].length;
      }
    }
  }
  return { start, end, seconds, unit };
};

const VERBS: Record<string, readonly string[]> = {
  bake: ["bakes", "baked", "baking"],
  roast: ["roasts", "roasted", "roasting"],
  boil: ["boils", "boiled", "boiling"],
  simmer: ["simmers", "simmered", "simmering"],
  rest: ["rests", "rested", "resting"],
  fry: ["fries", "fried", "frying"],
  knead: ["kneads", "kneaded", "kneading"],
  leave: ["leaves", "left", "leaving"],
  soak: ["soaks", "soaked", "soaking"],
  cook: ["cooks", "cooked", "cooking"],
  warm: ["warms", "warmed", "warming"],
  grill: ["grills", "grilled", "grilling"],
  broil: ["broils", "broiled", "broiling"],
  steam: ["steams", "steamed", "steaming"],
  chill: ["chills", "chilled", "chilling"],
  marinate: ["marinates", "marinated", "marinating"],
  prove: ["proves", "proved", "proving"],
  proof: ["proofs", "proofed", "proofing"],
  rise: ["rises", "rose", "risen", "rising"],
  poach: ["poaches", "poached", "poaching"],
  braise: ["braises", "braised", "braising"],
  stew: ["stews", "stewed", "stewing"],
  toast: ["toasts", "toasted", "toasting"],
  sear: ["sears", "seared", "searing"],
  brown: ["browns", "browned", "browning"],
  blanch: ["blanches", "blanched", "blanching"],
  steep: ["steeps", "steeped", "steeping"],
  infuse: ["infuses", "infused", "infusing"],
  cool: ["cools", "cooled", "cooling"],
  freeze: ["freezes", "froze", "frozen", "freezing"],
  set: ["sets", "setting"],
  reduce: ["reduces", "reduced", "reducing"],
  microwave: ["microwaves", "microwaved", "microwaving"],
  heat: ["heats", "heated", "heating"],
  sauté: ["sautés", "sautéed", "sautéing", "saute", "sautes", "sauteed", "sauteing"],
  stir: ["stirs", "stirred", "stirring"],
  whisk: ["whisks", "whisked", "whisking"],
  beat: ["beats", "beaten", "beating"],
  blend: ["blends", "blended", "blending"],
  mix: ["mixes", "mixed", "mixing"],
  churn: ["churns", "churned", "churning"],
  drain: ["drains", "drained", "draining"],
  thaw: ["thaws", "thawed", "thawing"],
  defrost: ["defrosts", "defrosted", "defrosting"],
  stand: ["stands", "stood", "standing"],
  sit: ["sits", "sat", "sitting"],
  brine: ["brines", "brined", "brining"],
  smoke: ["smokes", "smoked", "smoking"],
  dry: ["dries", "dried", "drying"],
  caramelise: ["caramelises", "caramelised", "caramelising", "caramelize", "caramelizes", "caramelized", "caramelizing"],
  bubble: ["bubbles", "bubbled", "bubbling"],
  sizzle: ["sizzles", "sizzled", "sizzling"],
  cream: ["creams", "creamed", "creaming"],
};
const BASE_OF = new Map<string, string>(
  Object.entries(VERBS).flatMap(([base, forms]) => [[base, base] as const, ...forms.map((form) => [form, base] as const)]),
);
const LEADS_A_COMMAND = new Set(["and", "then", "to", "or", "also", "again", "now", "just", "it", "them", "let"]);
const SENTENCE_START = /^(?:.*[.!?]\s+)?/su;
const capitalised = (word: string) => word[0]!.toUpperCase() + word.slice(1);

interface Word {
  text: string;
  afterBreak: boolean;
}

const wordsBefore = (text: string): Word[] => {
  const words: Word[] = [];
  let afterBreak = true;
  for (const match of text.matchAll(/([\p{L}'’-]+)|([.,;:!?()–—])/gu)) {
    if (match[2] !== undefined) {
      afterBreak = true;
      continue;
    }
    words.push({ text: match[1]!.toLowerCase(), afterBreak });
    afterBreak = false;
  }
  return words;
};

const isCommand = (words: readonly Word[], at: number): boolean => {
  const word = words[at]!;
  if (BASE_OF.get(word.text) !== word.text) return false;
  for (let before = at; before >= 0; before -= 1) {
    if (words[before]!.afterBreak) return true;
    const previous = words[before - 1]!.text;
    if (LEADS_A_COMMAND.has(previous)) return true;
    if (!previous.endsWith("ly")) return false;
  }
  return true;
};

// The verb a timer waits on: the nearest cooking verb before the time in its sentence, said as a command
// ("…and rest it for 5 minutes"), else the nearest in any form ("until cooked, about 15
// minutes"), from a short list held here (design 284g). A list misses some; the timer is then
// named by its step instead.
export function timerName(before: string): string | null {
  const words = wordsBefore(before.replace(SENTENCE_START, ""));
  for (let at = words.length - 1; at >= 0; at -= 1) {
    if (isCommand(words, at)) return capitalised(words[at]!.text);
  }
  for (let at = words.length - 1; at >= 0; at -= 1) {
    const base = BASE_OF.get(words[at]!.text);
    if (base !== undefined) return capitalised(base);
  }
  return null;
}

// The times an action gives, each as its span in the text and its length in seconds, and a
// range as both its ends (owner, 12 Nov 2026). Code reads them, never a model
// (docs/prototype/constraints.md). A time that isn't a wait ("within 30 minutes", "every 5
// minutes") and anything over a day are left alone.
export function methodTimes(text: string): MethodTime[] {
  const times: MethodTime[] = [];
  let from = 0;
  for (const match of text.matchAll(SPAN)) {
    if (match.index < from) continue;
    const found = read(text, match);
    if (found === null) continue;
    from = found.end;
    if (NOT_A_WAIT.test(text.slice(0, found.start))) continue;
    if (found.seconds.some((seconds) => seconds < 1 || seconds > MOST_SECONDS)) continue;
    if (found.seconds.length === 2 && found.seconds[1]! <= found.seconds[0]!) continue;
    times.push({ start: found.start, end: found.end, seconds: found.seconds, name: timerName(text.slice(0, found.start)) });
  }
  return times;
}
