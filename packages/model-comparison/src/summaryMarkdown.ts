import type { ModelSummary } from "./summariseRuns.js";

const dollars = (value: number | null) => (value === null ? "unpriced" : `$${value.toFixed(value < 0.1 ? 4 : 2)}`);
const seconds = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)}s`);
const percent = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);

export function summaryMarkdown(summaries: readonly ModelSummary[], runName: string): string {
  const checkNames = [...new Set(summaries.flatMap((summary) => Object.keys(summary.checks)))];
  const lines = [
    `# Model comparison: ${runName}`,
    "",
    "Every figure here is measured by code from the providers' own usage reports and the price table in",
    "`packages/model-comparison/src/modelPrices.ts`. Nothing is estimated by a model.",
    "",
    "| Model | Runs | Valid first time | After retry | Failed | Errored | Median latency | Mean cost | Cost per 20 min of video | Total spent |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...summaries.map(
      (summary) =>
        `| ${summary.name} | ${summary.runs} | ${percent(summary.passedFirst, summary.runs)} | ${summary.passedAfterRetry} | ` +
        `${summary.failed} | ${summary.errored} | ${seconds(summary.medianLatencyMs)} | ${dollars(summary.meanCostDollars)} | ` +
        `${dollars(summary.costPerTwentyMinutesDollars)} | ${dollars(summary.totalCostDollars)}` +
        (summary.unpricedRuns > 0 ? ` (${summary.unpricedRuns} unpriced)` : "") +
        " |",
    ),
    "",
    "## Automatic checks, share of passing overviews that pass each",
    "",
    `| Model | ${checkNames.join(" | ")} |`,
    `|---|${checkNames.map(() => "---").join("|")}|`,
    ...summaries.map(
      (summary) =>
        `| ${summary.name} | ${checkNames
          .map((name) => {
            const tally = summary.checks[name];
            return tally === undefined ? "–" : `${percent(tally.passed, tally.total)} (${tally.passed}/${tally.total})`;
          })
          .join(" | ")} |`,
    ),
    "",
  ];
  return lines.join("\n");
}
