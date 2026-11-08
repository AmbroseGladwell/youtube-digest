import type { CandidateResult } from "./JudgeRecord.js";
import type { KeyPointsJudgeRecord } from "./KeyPointsJudgeRecord.js";
import { KEY_POINT_DIMENSIONS } from "./keyPointsRubric.js";
import { winRate, type Tally } from "./summariseJudging.js";

export interface KeyPointsVideo {
  videoId: string;
  title: string;
  length: string;
}

const tallyOf = (results: readonly CandidateResult[]): Tally => ({
  win: results.filter((result) => result === "win").length,
  tie: results.filter((result) => result === "tie").length,
  loss: results.filter((result) => result === "loss").length,
});

const percent = (rate: number | null) => (rate === null ? "–" : `${Math.round(rate * 100)}%`);

// The first answer had the candidate as A, the second as B, so the same letter twice means
// the judge picked by position rather than by note.
export const sameLetterBothOrders = (record: KeyPointsJudgeRecord): boolean =>
  record.candidateFirst !== null &&
  record.candidateSecond !== null &&
  record.candidateFirst.overall.winner !== "tie" &&
  record.candidateFirst.overall.winner === record.candidateSecond.overall.winner;

export function keyPointsJudgingMarkdown(
  records: readonly KeyPointsJudgeRecord[],
  videos: readonly KeyPointsVideo[],
  candidateRun: string,
  baselineRun: string,
): string {
  const judged = records.filter((record) => record.results !== null);
  const dimensions = [...KEY_POINT_DIMENSIONS, "overall" as const];
  const cost = records.reduce((total, record) => total + (record.costDollars ?? 0), 0);
  const lines = [
    `# Key points judged: ${candidateRun} against ${baselineRun}`,
    "",
    `Each video's key points from \`${candidateRun}\` against the same model's from \`${baselineRun}\`, by ` +
      `${[...new Set(judged.map((record) => record.judge))].join(", ") || "no judge yet"}. The judge sees only the ` +
      "key points, with each note's premise and core claim for context. Every pair is judged in both orders, and a " +
      "side wins only when both orders agree, so a split counts as a tie.",
    "",
    `${judged.length} judged, ${records.length - judged.length} failed or errored, $${cost.toFixed(2)} spent.`,
    "",
    "| Dimension | Wins | Ties | Losses | Win rate |",
    "|---|---|---|---|---|",
    ...dimensions.map((dimension) => {
      const tally = tallyOf(judged.map((record) => record.results![dimension]));
      return `| ${dimension} | ${tally.win} | ${tally.tie} | ${tally.loss} | ${percent(winRate(tally))} |`;
    }),
    "",
    "A tie counts as half a win, so 50% is level.",
    "",
    `**Picked by position:** on ${judged.filter(sameLetterBothOrders).length} of ${judged.length} pairs the judge ` +
      "chose the same letter in both orders, so its overall call followed position rather than the note.",
    "",
    "| Video | Length | Overall | Choice | Completeness | Faithfulness |",
    "|---|---|---|---|---|---|",
  ];
  for (const video of videos) {
    const record = judged.find((candidate) => candidate.videoId === video.videoId);
    if (record === undefined) continue;
    const results = record.results!;
    lines.push(`| ${video.title} | ${video.length} | ${results.overall} | ${results.choice} | ${results.completeness} | ${results.faithfulness} |`);
  }
  lines.push("", "## Reasons", "");
  for (const video of videos) {
    const record = judged.find((candidate) => candidate.videoId === video.videoId);
    if (record === undefined) continue;
    lines.push(
      `**${video.title}**: ${record.results!.overall}.`,
      `- Candidate as A: ${record.candidateFirst!.overall.winner}. ${record.candidateFirst!.overall.reason}`,
      `- Candidate as B: ${record.candidateSecond!.overall.winner}. ${record.candidateSecond!.overall.reason}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}
