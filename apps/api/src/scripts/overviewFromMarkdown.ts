import {
  ArticlePlace,
  DUBIOUS_BASIS_LABEL,
  NOVELTY_LABEL,
  OverviewId,
  SELLING_LABEL,
  WATCH_ANYWAY_LABEL,
  type DubiousBasis,
  type DubiousClaim,
  type Novelty,
  type Overview,
  type RecipeStep,
  type SellingType,
  type WatchAnswer,
} from "@overview/domain";

// An overview's items back from overviewMarkdown, so chatHarnessCheck can put the library's real
// notes in the prompt (OV-319): a video's, an article's chapters and Read it anyway?, and a
// recipe page's figures, ingredients and method (OV-320). It reads only what the chat prompt
// shows; an article's resources and which chapter each key point came from aren't in it.

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

const READ_ANYWAY: Record<string, "yes" | "no" | "partial"> = { Yes: "yes", No: "no", "Just part of it": "partial" };
const ARTICLE_CHAPTER = /^\[(.*?)\]\(([^)]*)\): (.*)$/;

// A place's address, back to its anchor or its quoted text (articlePlaceUrl).
function placeOf(url: string): ArticlePlace {
  const hash = url.indexOf("#");
  const fragment = hash === -1 ? "" : url.slice(hash + 1);
  return fragment.startsWith(":~:text=")
    ? { anchor: null, quote: decodeURIComponent(fragment.slice(":~:text=".length).split(",")[0]!) }
    : { anchor: fragment === "" ? null : decodeURIComponent(fragment), quote: "" };
}

const minutesOf = (value: string): number =>
  [...value.matchAll(/(\d+) (hr|min)/g)].reduce((total, [, count, unit]) => total + Number(count) * (unit === "hr" ? 60 : 1), 0);

function recipeFrom(found: Map<string, string>): Overview["recipe"] {
  const ingredients = bulletsOf(found.get("Ingredients") ?? "");
  const steps: RecipeStep[] = [];
  let group: string | null = null;
  for (const line of (found.get("Method") ?? "").split("\n")) {
    const heading = /^### (.*)$/.exec(line);
    if (heading !== null) group = heading[1]!;
    const step = /^\d+\. (.*)$/.exec(line);
    if (step !== null) steps.push({ text: step[1]!, group });
  }
  const [first = "", ...rest] = (found.get("Summary") ?? "").split("\n\n");
  const figures = new Map(
    first.includes(" · ") || /^(Prep|Cook|Total|Makes|Serves) /.test(first)
      ? first.split(" · ").map((figure) => [figure.split(" ")[0]!, figure.slice(figure.indexOf(" ") + 1)] as const)
      : [],
  );
  const minutes = (label: string) => (figures.has(label) ? minutesOf(figures.get(label)!) : null);
  const made = figures.get("Makes") ?? figures.get("Serves");
  return {
    summary: (figures.size === 0 ? [first, ...rest] : rest).join("\n\n"),
    ingredients,
    steps,
    stepCount: steps.length,
    prepMinutes: minutes("Prep"),
    cookMinutes: minutes("Cook"),
    totalMinutes: minutes("Total"),
    yield: made === undefined ? null : `${figures.has("Serves") ? "Serves" : "Makes"} ${made}`,
  };
}

export function overviewFromMarkdown(markdown: string): Partial<Overview> {
  const found = sections(markdown);
  const overview: Partial<Overview> = {};
  if (found.has("Ingredients")) {
    overview.recipe = recipeFrom(found);
    overview.keyPoints = [];
    overview.coreClaim = "";
    return overview;
  }

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
    const similarLine = /^Similar (?:to|overviews in the reader's library): (.*)$/m.exec(verdict)?.[1] ?? "";
    const similarTo = [...similarLine.matchAll(/(.+?) \(([0-9a-f-]{36})\)(?:; |$)/g)].map(([, title, overviewId]) => ({
      title: title!,
      overviewId: OverviewId.parse(overviewId),
    }));
    overview.verdict = { novelty, standsOut: null, dubious, dubiousClaims, reasoning, similarTo };
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
    const reason = anyway.slice(WATCH_ANYWAY_LABEL[answer].length).replace(/^\.\s*/, "");
    const where = new RegExp(` ${LINK.source}$`).exec(reason);
    overview.watchAnyway = {
      answer,
      reason: where === null ? reason : reason.slice(0, where.index),
      range: where === null ? null : { startMs: clockMs(where[1]!), endMs: clockMs(where[2] ?? where[1]!) },
    };
  }

  const chapters = found.get("Chapters");
  const readAnyway = found.get("Read it anyway?");
  if (readAnyway !== undefined) {
    const answer = Object.keys(READ_ANYWAY).find((label) => readAnyway.startsWith(`${label}. `)) ?? "No";
    const articleChapters = bulletsOf(chapters ?? "").flatMap((line) => {
      const match = ARTICLE_CHAPTER.exec(line);
      return match === null ? [] : [{ title: match[1]!, summary: match[3]!, place: placeOf(match[2]!), wordCount: 500 }];
    });
    overview.chapters = null;
    overview.article = {
      chapters: articleChapters,
      keyPointChapters: (overview.keyPoints ?? []).map(() => null),
      // Which chapters a partial answer names isn't in the Markdown, nor in the prompt; one stands in.
      readAnyway: {
        answer: READ_ANYWAY[answer]!,
        reason: readAnyway.slice(answer.length + 2),
        leftOut: "",
        chapterIndexes: READ_ANYWAY[answer] === "partial" ? [0] : [],
      },
    };
  } else if (chapters !== undefined) {
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
