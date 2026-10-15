import { JUDGE_DIMENSIONS } from "./judgeRubric.js";
import { winRate, type CandidateJudging, type Tally } from "./summariseJudging.js";

const rate = (tally: Tally) => {
  const value = winRate(tally);
  return value === null ? "–" : `${Math.round(value * 100)}%`;
};
const record = (tally: Tally) => `${tally.win}–${tally.tie}–${tally.loss}`;

export function judgingMarkdown(summaries: readonly CandidateJudging[]): string {
  if (summaries.length === 0) return "";
  const baseline = summaries[0]!.baseline;
  return [
    `## Judged against ${baseline}`,
    "",
    "Win rate counts a tie as half a win, so 50% is level with the baseline. Records are wins–ties–losses.",
    "No judge reads a note from its own provider.",
    "",
    `| Candidate | Judge | Overall | Record | ${JUDGE_DIMENSIONS.join(" | ")} | Judge cost |`,
    `|---|---|---|---|${JUDGE_DIMENSIONS.map(() => "---").join("|")}|---|`,
    ...summaries.map(
      (summary) =>
        `| ${summary.candidate} | ${summary.judges.join(", ") || "–"} | ${rate(summary.byDimension.overall)} | ` +
        `${record(summary.byDimension.overall)}${summary.unjudged > 0 ? ` (${summary.unjudged} unjudged)` : ""} | ` +
        `${JUDGE_DIMENSIONS.map((dimension) => rate(summary.byDimension[dimension])).join(" | ")} | ` +
        `$${summary.judgeCostDollars.toFixed(2)} |`,
    ),
    "",
    "## Blind picks",
    "",
    "| Candidate | Picks | Your win rate for it | Your record | Agrees with the judge |",
    "|---|---|---|---|---|",
    ...summaries.map((summary) => {
      const picks = summary.picks.win + summary.picks.tie + summary.picks.loss;
      const { agreed, compared } = summary.agreement;
      return (
        `| ${summary.candidate} | ${picks} | ${rate(summary.picks)} | ${record(summary.picks)} | ` +
        `${compared === 0 ? "–" : `${agreed} of ${compared}`} |`
      );
    }),
    "",
  ].join("\n");
}
