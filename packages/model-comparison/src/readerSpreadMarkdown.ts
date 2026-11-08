import type { FetchedTranscript } from "@overview/transcripts";
import type { ActionsByReader, PairSpread, ReaderSpread } from "./readerSpread.js";
import { NOISE_PAIR, type SpreadReader } from "./spreadReaders.js";

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
