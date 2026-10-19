import type { FetchedTranscript } from "@overview/transcripts";
import { PERSONAL_DIMENSIONS, type PersonalJudgeRecord } from "./judgePersonalPair.js";
import type { RunRecord } from "./RunRecord.js";
import { isPassed, videoLengthMs } from "./summariseRuns.js";
import { promptTokensOf } from "./TokenUsage.js";

export interface CostModelArms {
  stageOne: readonly RunRecord[];
  single: readonly RunRecord[];
  personalFromNote: readonly RunRecord[];
  personalWithTranscript: readonly RunRecord[];
}

export interface ArmCost {
  videos: number;
  meanCostDollars: number;
  costPerTwentyMinutesDollars: number;
  medianPromptTokens: number;
  medianOutputTokens: number;
}

const TWENTY_MINUTES_MS = 20 * 60_000;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function armCost(
  records: readonly RunRecord[],
  videoIds: ReadonlySet<string>,
  transcripts: ReadonlyMap<string, FetchedTranscript>,
): ArmCost {
  const counted = records.filter((record) => videoIds.has(record.videoId) && record.costDollars !== null);
  const answered = (record: RunRecord) => record.calls.filter((call) => call.usage !== null).map((call) => call.usage!);
  const totalCost = sum(counted.map((record) => record.costDollars!));
  const totalLengthMs = sum(counted.map((record) => videoLengthMs(transcripts.get(record.videoId)!)));
  return {
    videos: counted.length,
    meanCostDollars: counted.length === 0 ? 0 : totalCost / counted.length,
    costPerTwentyMinutesDollars: totalLengthMs === 0 ? 0 : (totalCost * TWENTY_MINUTES_MS) / totalLengthMs,
    medianPromptTokens: median(counted.map((record) => sum(answered(record).map(promptTokensOf)))),
    medianOutputTokens: median(counted.map((record) => sum(answered(record).map((usage) => usage.outputTokens)))),
  };
}

export const breakEvenReaders = (stageOne: number, personal: number, single: number): number | null =>
  single <= personal ? null : stageOne / (single - personal);

export const hybridCostPerReader = (stageOne: number, personal: number, readers: number): number =>
  stageOne / readers + personal;

const dollars = (value: number) => `$${value.toFixed(4)}`;

function judgingTable(judgments: readonly PersonalJudgeRecord[], candidate: string): string {
  const judged = judgments.filter((record) => record.candidate === candidate && record.results !== null);
  const rows = [...PERSONAL_DIMENSIONS, "overall" as const].map((dimension) => {
    const results = judged.map((record) => record.results![dimension]);
    const count = (result: string) => results.filter((value) => value === result).length;
    return `| ${dimension} | ${count("win")} | ${count("tie")} | ${count("loss")} |`;
  });
  return [`${judged.length} pairs judged.`, "", "| Dimension | Wins | Ties | Losses |", "|---|---|---|---|", ...rows].join(
    "\n",
  );
}

export function costModelMarkdown(
  arms: CostModelArms,
  judgments: readonly PersonalJudgeRecord[],
  transcripts: ReadonlyMap<string, FetchedTranscript>,
): string {
  const passedIds = (records: readonly RunRecord[]) => new Set(records.filter(isPassed).map((record) => record.videoId));
  const inAll = [...passedIds(arms.single)].filter(
    (id) => passedIds(arms.stageOne).has(id) && passedIds(arms.personalFromNote).has(id) && passedIds(arms.personalWithTranscript).has(id),
  );
  const videoIds = new Set(inAll);

  const stageOne = armCost(arms.stageOne, videoIds, transcripts);
  const single = armCost(arms.single, videoIds, transcripts);
  const fromNote = armCost(arms.personalFromNote, videoIds, transcripts);
  const withTranscript = armCost(arms.personalWithTranscript, videoIds, transcripts);

  const row = (name: string, cost: ArmCost) =>
    `| ${name} | ${cost.videos} | ${dollars(cost.meanCostDollars)} | ${dollars(cost.costPerTwentyMinutesDollars)} | ${cost.medianPromptTokens} | ${cost.medianOutputTokens} |`;

  const readerRow = (readers: number) =>
    `| ${readers} | ${dollars(single.meanCostDollars)} | ${dollars(hybridCostPerReader(stageOne.meanCostDollars, fromNote.meanCostDollars, readers))} | ${dollars(hybridCostPerReader(stageOne.meanCostDollars, withTranscript.meanCostDollars, readers))} |`;

  const breakEven = (personal: ArmCost) => {
    const readers = breakEvenReaders(stageOne.meanCostDollars, personal.meanCostDollars, single.meanCostDollars);
    return readers === null ? "never" : `${readers.toFixed(2)} readers`;
  };

  const passRate = (records: readonly RunRecord[]) =>
    `${records.filter((record) => record.outcome === "passed-first").length} first time, ` +
    `${records.filter((record) => record.outcome === "passed-after-retry").length} after the retry, ` +
    `${records.filter((record) => record.outcome === "failed").length} failed, ` +
    `${records.filter((record) => record.outcome === "errored").length} errored`;

  return `# Cost model: shared summary vs fully personalised

Costs are measured from the provider's own usage reports, over the ${inAll.length} videos every arm passed.

| Arm | Videos | Mean cost | Per 20 min of video | Median prompt tokens | Median output tokens |
|---|---|---|---|---|---|
${row("Stage 1: shared note, no reader", stageOne)}
${row("Single pass, personalised (today)", single)}
${row("Personal pass, from the note", fromNote)}
${row("Personal pass, with the transcript", withTranscript)}

## Cost per reader of one video

| Readers of the video | Single pass | Hybrid, from the note | Hybrid, with the transcript |
|---|---|---|---|
${[1, 2, 3, 5, 10].map(readerRow).join("\n")}

The hybrid costs less than a single pass from ${breakEven(fromNote)} (from the note) and ${breakEven(withTranscript)} (with the transcript).

## Reliability

- Single pass: ${passRate(arms.single)}
- Personal pass, from the note: ${passRate(arms.personalFromNote)}
- Personal pass, with the transcript: ${passRate(arms.personalWithTranscript)}

## Personal parts judged against the single pass

Wins are the hybrid's.

### From the note

${judgingTable(judgments, "personal-from-note")}

### With the transcript

${judgingTable(judgments, "personal-with-transcript")}
`;
}
