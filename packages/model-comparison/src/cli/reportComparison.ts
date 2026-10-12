import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { comparisonPaths, loadComparison } from "../comparisonPaths.js";
import { judgingMarkdown } from "../judgingMarkdown.js";
import { sideBySideHtml } from "../sideBySideHtml.js";
import { summariseJudging } from "../summariseJudging.js";
import { summariseRuns } from "../summariseRuns.js";
import { summaryMarkdown } from "../summaryMarkdown.js";

const { values } = parseArgs({ options: { run: { type: "string" } } });
if (!values.run) {
  console.error("usage: npm run report --workspace packages/model-comparison -- --run <name>");
  process.exit(1);
}

const directory = comparisonPaths.run(values.run);
const { runs, transcripts, byVideo, judgments, picks } = await loadComparison(values.run);
if (runs.length === 0) {
  console.error(`no runs in ${directory}`);
  process.exit(1);
}

const missing = [...new Set(runs.map((record) => record.videoId))].filter((id) => !byVideo.has(id));
if (missing.length > 0) {
  console.error(`the runs name transcripts that are not in ${comparisonPaths.transcripts}: ${missing.join(", ")}`);
  process.exit(1);
}

const markdown = summaryMarkdown(summariseRuns(runs, byVideo), values.run) + judgingMarkdown(summariseJudging(judgments, picks));
await writeFile(join(directory, "report.md"), markdown);
await writeFile(join(directory, "sideBySide.html"), sideBySideHtml(values.run, runs, transcripts));
console.log(markdown);
console.error(`Written to ${join(directory, "report.md")} and ${join(directory, "sideBySide.html")}`);
