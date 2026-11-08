import type { Coverage } from "./measureCoverage.js";

export interface CoverageRow {
  title: string;
  kind: "video" | "article";
  length: string;
  outcome: string;
  coverage: Coverage | null;
  gapPlace: string | null;
}

const percent = (share: number | null) => (share === null ? "–" : `${Math.round(share * 100)}%`);

const mean = (values: number[]) => (values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length);

function pointsCell({ points, unplaced, outOfRange }: Coverage): string {
  const notes = [unplaced > 0 ? `${unplaced} unplaced` : "", outOfRange > 0 ? `${outOfRange} out of range` : ""].filter(Boolean);
  return notes.length === 0 ? `${points}` : `${points} (${notes.join(", ")})`;
}

function rowCells({ title, kind, length, outcome, coverage, gapPlace }: CoverageRow): string[] {
  if (coverage === null) return [title, kind, length, outcome, "–", "–", "–", "–", "–"];
  if (!coverage.measurable) return [title, kind, length, "unmeasurable", pointsCell(coverage), "–", "–", "–", "–"];
  const gap = coverage.largestGap === null ? "none" : `${percent(coverage.largestGap.share)}, ${gapPlace}`;
  return [
    title,
    kind,
    length,
    "measured",
    pointsCell(coverage),
    percent(coverage.spanShare),
    `${percent(coverage.chapterShare)} (${coverage.chaptersReached} of ${coverage.chapters})`,
    gap,
    coverage.pointsByThird.join(" / "),
  ];
}

function kindSummary(kind: CoverageRow["kind"], rows: readonly CoverageRow[]): string {
  const measured = rows.filter((row) => row.kind === kind && row.coverage?.measurable).map((row) => row.coverage!);
  const all = rows.filter((row) => row.kind === kind).length;
  return (
    `| ${kind} | ${measured.length} of ${all} | ${percent(mean(measured.map((coverage) => coverage.spanShare!)))} | ` +
    `${percent(mean(measured.map((coverage) => coverage.chapterShare!)))} | ` +
    `${percent(mean(measured.map((coverage) => coverage.largestGap?.share ?? 0)))} |`
  );
}

export function coverageMarkdown(rows: readonly CoverageRow[], runName: string, model: string): string {
  return [
    `# Coverage: ${runName}`,
    "",
    `${model}, a blank reader. Every figure is counted by code from the key points' own positions in the`,
    "source, weighted by words (`measureCoverage.ts`). Nothing is asked of a model.",
    "",
    "- **In a point's range:** the share of the source's words inside some key point's range. An article's",
    "  key point names one paragraph, so this reads low for articles by design: compare like with like.",
    "- **In a reached chapter:** the share of words in chapters that at least one key point lands in.",
    "- **Largest gap:** the longest stretch, by words, that no key point lands in.",
    "- **By third:** key points whose middle falls in the first, middle and last third of the words.",
    "- **Unplaced:** key points with no position, which the model gives a point built across the source.",
    "  They are counted, not scored as uncovered.",
    "",
    "| Kind | Measured | In a point's range, mean | In a reached chapter, mean | Largest gap, mean |",
    "|---|---|---|---|---|",
    kindSummary("video", rows),
    kindSummary("article", rows),
    "",
    "| Source | Kind | Length | Outcome | Key points | In a point's range | In a reached chapter | Largest gap | By third |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${rowCells(row).join(" | ")} |`),
    "",
  ].join("\n");
}
