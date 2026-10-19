import { wordCount } from "@overview/domain";
import type { GeneratedOutput } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";

export type CheckArea = "overview" | "chapters";

export interface CheckResult {
  check: string;
  area: CheckArea;
  passed: boolean;
  detail: string | null;
}

interface Range {
  startSegmentIndex: number;
  endSegmentIndex: number;
}

const KEY_POINT_TARGET_WORDS = 40;
const DUBIOUS_CLAIM_TARGET_WORDS = 25;
const DUBIOUS_REASON_TARGET_WORDS = 30;
const LONGEST_CHAPTER_SHARE = 0.5;
const CHAPTERED_FROM_MS = 10 * 60_000;
const NOVELTY_WORDS = ["common knowledge", "fresh angle", "original"];
const ONE_LINE_OPENINGS = ["this video", "a video about"];

const result = (check: string, area: CheckArea, problems: string[]): CheckResult => ({
  check,
  area,
  passed: problems.length === 0,
  detail: problems.length === 0 ? null : problems.join("; "),
});

const rangeProblem = (label: string, range: Range | null, segments: number): string[] => {
  if (range === null) return [];
  if (range.startSegmentIndex > range.endSegmentIndex) {
    return [`${label} runs backwards, ${range.startSegmentIndex} to ${range.endSegmentIndex}`];
  }
  if (range.endSegmentIndex >= segments) {
    return [`${label} ends at segment ${range.endSegmentIndex} of ${segments}`];
  }
  return [];
};

function proseOf(output: GeneratedOutput): string[] {
  return [
    output.inOneLine,
    output.coreClaim,
    ...output.keyPoints.map((point) => point.text),
    ...output.chapters.flatMap((chapter) => [chapter.title, chapter.summary]),
    ...(output.verdict
      ? [
          output.verdict.reasoning,
          output.verdict.standsOut?.text ?? "",
          ...output.verdict.dubiousClaims.flatMap((claim) => [claim.claim, claim.reason]),
        ]
      : []),
    output.selling?.detail ?? "",
    ...(output.howToApply?.items ?? []),
    output.watchAnyway?.reason ?? "",
  ].filter((text) => text !== "");
}

const NUMBER = /\d+(?:[.,]\d+)*/g;
const normalisedNumber = (raw: string): string => raw.replace(/,(?=\d{3}\b)/g, "").replace(/[.,]$/, "");

const NUMBER_WORDS: Record<string, number> = Object.fromEntries(
  [
    ..."zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ").map((word, value) => [word, value] as const),
    ..."thirty forty fifty sixty seventy eighty ninety".split(" ").map((word, index) => [word, (index + 3) * 10] as const),
  ],
);
const SCALES: Record<string, number> = { hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };

const withoutSeparators = (source: string): string => source.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");

const spokenAsDigits = (source: string): string =>
  withoutSeparators(source)
    .replace(/\b([a-z]+)\b/gi, (word) => {
      const value = NUMBER_WORDS[word.toLowerCase()];
      return value === undefined ? word : String(value);
    })
    .replace(/(\d+(?:\.\d+)?)\s*(hundred|thousand|million|billion)\b/gi, (_, digits: string, scale: string) =>
      String(Math.round(Number(digits) * SCALES[scale.toLowerCase()]!)),
    );

export function unsupportedNumbers(prose: readonly string[], sources: readonly string[]): string[] {
  const haystack = sources.flatMap((source) => [withoutSeparators(source), spokenAsDigits(source)]).join("\n");
  const claimed = new Set(prose.flatMap((text) => (text.match(NUMBER) ?? []).map(normalisedNumber)));
  return [...claimed].filter((number) => {
    const escaped = number.replace(/\./g, "\\.");
    return !new RegExp(`(?<![\\d.])${escaped}(?![\\d]|\\.\\d)`).test(haystack);
  });
}

function longestChapterShare(output: GeneratedOutput, fetched: FetchedTranscript): number {
  const starts = output.chapters.map((chapter) => fetched.transcript[chapter.startSegmentIndex]?.startMs ?? 0);
  const endMs = fetched.transcript.at(-1)?.endMs ?? 0;
  if (endMs === 0) return 0;
  const lengths = starts.map((start, index) => (starts[index + 1] ?? endMs) - start);
  return Math.max(0, ...lengths) / endMs;
}

export function checkOverview(output: GeneratedOutput, fetched: FetchedTranscript): CheckResult[] {
  const segments = fetched.transcript.length;
  const verdict = output.verdict;
  const oneLine = output.inOneLine.trim().toLowerCase();
  const channel = fetched.video.channel.trim().toLowerCase();
  const share = longestChapterShare(output, fetched);
  const spokenLength = fetched.transcript.at(-1)?.endMs ?? 0;

  return [
    result(
      "keyPointRangesInside",
      "overview",
      output.keyPoints.flatMap((point, index) => rangeProblem(`key point ${index + 1}`, point.range, segments)),
    ),
    result("standsOutRangeInside", "overview", rangeProblem("standsOut", verdict?.standsOut?.range ?? null, segments)),
    result("watchAnywayRangeInside", "overview", rangeProblem("watch-anyway range", output.watchAnyway?.range ?? null, segments)),
    result(
      "keyPointsWithinTarget",
      "overview",
      output.keyPoints
        .map((point, index) => ({ index, words: wordCount(point.text) }))
        .filter(({ words }) => words > KEY_POINT_TARGET_WORDS)
        .map(({ index, words }) => `key point ${index + 1} is ${words} words`),
    ),
    result(
      "dubiousClaimsWithinTarget",
      "overview",
      (verdict?.dubiousClaims ?? []).flatMap((claim, index) => [
        ...(wordCount(claim.claim) > DUBIOUS_CLAIM_TARGET_WORDS ? [`dubious claim ${index + 1} is ${wordCount(claim.claim)} words`] : []),
        ...(wordCount(claim.reason) > DUBIOUS_REASON_TARGET_WORDS ? [`its reason is ${wordCount(claim.reason)} words`] : []),
      ]),
    ),
    result(
      "reasoningDoesNotOpenWithNovelty",
      "overview",
      verdict && NOVELTY_WORDS.some((word) => verdict.reasoning.trim().toLowerCase().startsWith(word))
        ? [`reasoning opens "${verdict.reasoning.slice(0, 30)}"`]
        : [],
    ),
    result("inOneLineOpening", "overview", [
      ...ONE_LINE_OPENINGS.filter((opening) => oneLine.startsWith(opening)).map((opening) => `opens with "${opening}"`),
      ...(channel !== "" && new RegExp(`\\b${channel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(oneLine)
        ? [`names the channel, ${fetched.video.channel}`]
        : []),
    ]),
    result(
      "noEmDash",
      "overview",
      proseOf(output)
        .filter((text) => text.includes("—"))
        .map((text) => `"${text.slice(0, 40)}"`),
    ),
    result(
      "numbersInTranscript",
      "overview",
      unsupportedNumbers(proseOf(output), [
        ...fetched.transcript.map((segment) => segment.text),
        fetched.video.title,
        fetched.video.description ?? "",
      ]).map((number) => `${number} is not in the transcript, title or description`),
    ),
    result(
      "chaptersSpreadAcrossVideo",
      "chapters",
      spokenLength >= CHAPTERED_FROM_MS && share > LONGEST_CHAPTER_SHARE
        ? [`one chapter is ${Math.round(share * 100)}% of the video`]
        : [],
    ),
  ];
}
