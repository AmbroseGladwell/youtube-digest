import {
  DUBIOUS_BASIS_LABEL,
  NOVELTY_LABEL,
  SELLING_LABEL,
  WATCH_ANYWAY_LABEL,
  type DubiousBasis,
  type DubiousClaim,
  type Novelty,
  type Overview,
  type SellingType,
  type WatchAnswer,
} from "@overview/domain";

// A YouTube overview's items back from overviewMarkdown, so chatHarnessCheck can put the library's
// real notes in the prompt (OV-319). It reads only what the chat prompt gives ids to.

const clockMs = (clock: string) => clock.split(":").reduce((total, part) => total * 60 + Number(part), 0) * 1000;
const LINK = /\[(\d+(?::\d+)+)(?:–(\d+(?::\d+)+))?\]\([^)]*\)/;
const keyOf = <K extends string>(labels: Record<K, string>, text: string): K | undefined =>
  (Object.keys(labels) as K[]).find((key) => text.startsWith(labels[key]));

function sections(markdown: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const block of markdown.split(/^## /m).slice(1)) {
    const newline = block.indexOf("\n");
    found.set(block.slice(0, newline).trim(), block.slice(newline + 1).trim());
  }
  return found;
}

const bulletsOf = (body: string) =>
  body
    .split("\n")
    .filter((line) => /^(- |\d+\. )/.test(line))
    .map((line) => line.replace(/^(- |\d+\. )/, ""));

function trailingRange(text: string): { text: string; range: { startMs: number; endMs: number } | null } {
  const match = new RegExp(` \\(${LINK.source}\\)$`).exec(text);
  if (match === null) return { text, range: null };
  const startMs = clockMs(match[1]!);
  return { text: text.slice(0, match.index), range: { startMs, endMs: match[2] === undefined ? startMs : clockMs(match[2]) } };
}

export function overviewFromMarkdown(markdown: string): Partial<Overview> {
  const found = sections(markdown);
  const overview: Partial<Overview> = {};

  const keyPoints = found.get("Key points");
  if (keyPoints !== undefined) overview.keyPoints = bulletsOf(keyPoints).map(trailingRange);

  const verdict = found.get("Verdict");
  if (verdict !== undefined) {
    const [first = ""] = verdict.split("\n\n");
    const novelty = keyOf(NOVELTY_LABEL, first) as Novelty;
    const dubious = first.startsWith(`${NOVELTY_LABEL[novelty]}, and dubious`);
    const reasoning = first.replace(/^[^.]*\.\s*/, "");
    const dubiousAt = verdict.indexOf("Why it is dubious:");
    const dubiousClaims: DubiousClaim[] | null =
      dubiousAt === -1
        ? null
        : bulletsOf(verdict.slice(dubiousAt)).map((line) => {
            const at = LINK.exec(line);
            const rest = at === null ? line : line.slice(at.index + at[0].length).trim();
            const quote = /^“(.*)”: (.*)$/.exec(rest);
            const claim = quote?.[1] ?? rest;
            const after = quote?.[2] ?? "";
            const basis = (keyOf(DUBIOUS_BASIS_LABEL, after) ?? "contradictsSettled") as DubiousBasis;
            return {
              claim,
              basis,
              reason: after.slice(DUBIOUS_BASIS_LABEL[basis].length).replace(/^\.\s*/, ""),
              startMs: at === null ? null : clockMs(at[1]!),
            };
          });
    overview.verdict = { novelty, standsOut: null, dubious, dubiousClaims, reasoning, similarTo: [] };
  }

  const steps = found.get("The steps it gives");
  if (steps !== undefined) {
    overview.sourceSteps = {
      items: bulletsOf(steps).map((line) => {
        const { text, range } = trailingRange(line);
        const dubious = / _\(dubious: (.*)\)_$/.exec(text);
        return {
          text: dubious === null ? text : text.slice(0, dubious.index),
          range: range === null ? null : { startMs: range.startMs, endMs: range.startMs },
          dubiousReason: dubious?.[1] ?? null,
        };
      }),
    };
  }

  const apply = found.get("How to apply");
  if (apply !== undefined) overview.howToApply = { items: bulletsOf(apply) };

  const selling = found.get("What it sells");
  if (selling !== undefined) {
    const type = (keyOf(SELLING_LABEL, selling) ?? "own_paid_product") as SellingType;
    overview.selling = { type, detail: selling.slice(SELLING_LABEL[type].length).replace(/^\.\s*/, ""), compromisesContent: false };
  }

  const anyway = found.get("Watch it anyway?");
  if (anyway !== undefined) {
    const answer = (keyOf(WATCH_ANYWAY_LABEL, anyway) ?? "no") as WatchAnswer;
    overview.watchAnyway = { answer, reason: anyway.slice(WATCH_ANYWAY_LABEL[answer].length).replace(/^\.\s*/, ""), range: null };
  }

  const chapters = found.get("Chapters");
  if (chapters !== undefined) {
    const parsed = bulletsOf(chapters).flatMap((line) => {
      const match = new RegExp(`^${LINK.source} \\*\\*(.*?)\\*\\*: (.*)$`).exec(line);
      return match === null ? [] : [{ title: match[3]!, summary: match[4]!, startMs: clockMs(match[1]!) }];
    });
    overview.chapters = parsed.map((chapter, index) => ({ ...chapter, endMs: parsed[index + 1]?.startMs ?? chapter.startMs + 60_000 }));
  }

  const premise = found.get("Premise");
  if (premise !== undefined) overview.inOneLine = premise;
  const core = found.get("Core claim");
  if (core !== undefined) overview.coreClaim = core;
  const big = found.get("Big picture");
  if (big !== undefined) overview.bigPicture = big;
  return overview;
}
