import type { FetchedTranscript } from "@overview/transcripts";
import { contextUse, type ActionsByReader, type PairSpread, type ReaderSpread } from "./readerSpread.js";
import { BEFORE, NOISE_PAIR, type SpreadReader } from "./spreadReaders.js";
import type { ActionJudgmentSummary } from "./summariseActionJudgments.js";

const percent = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);
const overlap = (value: number | null) => (value === null ? "–" : value.toFixed(2));
const isNoise = (pair: PairSpread) => pair.left === NOISE_PAIR[0] && pair.right === NOISE_PAIR[1];
const isAboutNobody = (pair: PairSpread) => NOISE_PAIR.some((name) => name === pair.left || name === pair.right);

// Readers' actions are personalised only where they overlap less than two runs for nobody do.
export function personalisedVerdict(spread: ReaderSpread): string {
  const noise = spread.pairs.find(isNoise)?.meanWordOverlap ?? null;
  const between = spread.pairs.filter((pair) => !isAboutNobody(pair));
  const above = between.filter((pair) => pair.meanWordOverlap !== null && noise !== null && pair.meanWordOverlap >= noise);
  if (noise === null || between.length === 0) return "Not enough passed videos to say.";
  if (above.length === 0) return `Every pair of readers overlaps less than two runs for nobody (${overlap(noise)}): the actions change with the reader.`;
  return `${above.length} of ${between.length} reader pairs overlap as much as two runs for nobody (${overlap(noise)}) or more: for them, the context made no difference sampling didn't.`;
}

export function readerSpreadMarkdown(
  readers: readonly SpreadReader[],
  spread: ReaderSpread,
  byVideo: ReadonlyMap<string, ActionsByReader>,
  transcripts: ReadonlyMap<string, FetchedTranscript>,
  judged: { judge: string; summaries: readonly ActionJudgmentSummary[] } | null = null,
): string {
  const pairRow = (pair: PairSpread) =>
    `| ${pair.left} · ${pair.right} | ${pair.videos} | ${pair.bothEmpty} | ${pair.identical} (${percent(pair.identical, pair.videos)}) | ${overlap(pair.meanWordOverlap)} |`;
  const lines = [
    "# How to apply for different readers",
    "",
    `${spread.videos} videos where every reader's overview passed. ${spread.sameForEveryone} had the same actions for everyone.`,
    "",
    personalisedVerdict(spread),
    "",
    "## Readers",
    "",
    ...readers.map((reader) => `- **${reader.name}**: ${reader.readerContext ?? "no reader context"}`),
    "",
    "## Pairs",
    "",
    "Word overlap is shared words over all words in either pair's actions: 1 the same words, 0 none in common, taken over the videos where at least one of the pair had something to do. Both empty is counted apart: nothing for either reader agrees, but isn't evidence the context was ignored. The first row is the noise floor.",
    "",
    "| Pair | Videos | Both empty | Identical | Mean word overlap |",
    "|---|---|---|---|---|",
    ...spread.pairs.filter(isNoise).map(pairRow),
    ...spread.pairs.filter((pair) => !isNoise(pair) && isAboutNobody(pair)).map(pairRow),
    ...spread.pairs.filter((pair) => !isAboutNobody(pair)).map(pairRow),
    "",
    "## Actions per overview",
    "",
    "| Reader | 0 | 1 | 2 | 3 |",
    "|---|---|---|---|---|",
    ...readers.map((reader) => `| ${reader.name} | ${(spread.itemCounts[reader.name] ?? [0, 0, 0, 0]).join(" | ")} |`),
    "",
    "## Context used",
    "",
    "Actions naming one of the reader's cue words, from their sentence or their learned items, against how many of nobody's actions hit the same words by chance. A keyword proxy: it can't tell a fitted action from one that merely names the reader's job.",
    "",
    "| Reader | Actions | From the sentence | From learned | Either | On videos | Nobody, same words |",
    "|---|---|---|---|---|---|---|",
    ...readers
      .filter((reader) => reader.readerContext !== null)
      .map((reader) => contextUse(reader, NOISE_PAIR[0], byVideo))
      .map(
        (use) =>
          `| ${use.reader} | ${use.actions} | ${use.fromSentence} | ${use.fromLearned} | ${use.fromEither} (${percent(use.fromEither, use.actions)}) | ${use.videos} | ${use.nobodyFromEither} of ${use.nobodyActions} (${percent(use.nobodyFromEither, use.nobodyActions)}) |`,
      ),
    "",
    ...(judged === null ? [] : judgedLines(judged.judge, judged.summaries)),
    "## Each video",
    "",
    "For reading by eye: an action that misreads its reader is the worst failure and only a person can see it.",
    "",
  ];
  for (const [videoId, actions] of byVideo) {
    lines.push(`### ${transcripts.get(videoId)?.video.title ?? videoId}`, "");
    for (const reader of readers) {
      const items = actions.get(reader.name) ?? [];
      lines.push(`**${reader.name}**${items.length === 0 ? ": nothing to do" : ""}`, ...items.map((item) => `- ${item}`), "");
    }
  }
  return lines.join("\n");
}

function judgedLines(judge: string, summaries: readonly ActionJudgmentSummary[]): string[] {
  const share = (part: number, whole: number) => `${part} (${percent(part, whole)})`;
  const known = summaries.filter((summary) => !NOISE_PAIR.some((name) => name === summary.reader));
  return [
    "## Judged: practical and helpful",
    "",
    `Every action labelled by ${judge}, which wrote none of them, reading the transcript and every reader's actions at once with the readers' names hidden; code counts the labels. Practical and helpful is concrete, not contradicting the video, not misreading the reader, doable within a couple of weeks, and helpful.`,
    "",
    "| Reader | Videos | Actions | Practical and helpful | Concrete | Doable | Helpful | Marginal | Unhelpful | Contradicts the video | Beyond the video, sensibly |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...summaries.map(
      (s) =>
        `| ${s.reader} | ${s.videos} | ${s.actions} | ${share(s.practicalAndHelpful, s.actions)} | ${share(s.concrete, s.actions)} | ${share(s.doable, s.actions)} | ${share(s.helpful, s.actions)} | ${s.marginal} | ${s.unhelpful} | ${s.contradicts} | ${s.sensibleExtension} |`,
    ),
    "",
    ...beforeAndAfterLines(summaries),
    "### Fit to the reader",
    "",
    "| Reader | Fits | Generic | Misreads | Given nothing: right | Given nothing: missed |",
    "|---|---|---|---|---|---|",
    ...known.map(
      (s) =>
        `| ${s.reader} | ${share(s.fits, s.actions)} | ${share(s.generic, s.actions)} | ${share(s.misreads, s.actions)} | ${s.emptyRight} | ${s.emptyMissed} |`,
    ),
    "",
  ];
}

// Each reader's actions from the earlier run beside this run's, labelled in the same calls.
export function beforeAndAfterLines(summaries: readonly ActionJudgmentSummary[]): string[] {
  const byName = new Map(summaries.map((summary) => [summary.reader, summary]));
  const pairs = summaries.flatMap((after) => {
    const before = byName.get(`${after.reader}${BEFORE}`);
    return before === undefined ? [] : [[before, after] as const];
  });
  if (pairs.length === 0) return [];
  const rate = (part: number, whole: number) => percent(part, whole);
  return [
    "### Before and after, judged together",
    "",
    `Each reader's actions from the earlier run (${BEFORE}) and this run's, labelled in the same calls, so both are held to one bar.`,
    "",
    "| Reader | Practical and helpful, before | After | Fits, before | After | Marginal, before | After |",
    "|---|---|---|---|---|---|---|",
    ...pairs.map(
      ([before, after]) =>
        `| ${after.reader} | ${rate(before.practicalAndHelpful, before.actions)} | ${rate(after.practicalAndHelpful, after.actions)} | ${rate(before.fits, before.actions)} | ${rate(after.fits, after.actions)} | ${before.marginal} of ${before.actions} | ${after.marginal} of ${after.actions} |`,
    ),
    "",
  ];
}
