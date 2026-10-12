import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { comparisonPaths, loadTranscripts } from "../comparisonPaths.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { sideBySideHtml } from "../sideBySideHtml.js";
import { summariseRuns } from "../summariseRuns.js";
import { summaryMarkdown } from "../summaryMarkdown.js";

const { values } = parseArgs({ options: { run: { type: "string" } } });
if (!values.run) {
  console.error("usage: npm run report --workspace packages/model-comparison -- --run <name>");
  process.exit(1);
}

const directory = comparisonPaths.run(values.run);
const records = await runDirectoryStore(directory).all();
if (records.length === 0) {
  console.error(`no runs in ${directory}`);
  process.exit(1);
}

const transcripts = await loadTranscripts();
const byVideo = new Map(transcripts.map((fetched) => [fetched.video.id ?? fetched.video.url, fetched]));
const missing = [...new Set(records.map((record) => record.videoId))].filter((id) => !byVideo.has(id));
if (missing.length > 0) {
  console.error(`the runs name transcripts that are not in ${comparisonPaths.transcripts}: ${missing.join(", ")}`);
  process.exit(1);
}

const markdown = summaryMarkdown(summariseRuns(records, byVideo), values.run);
await writeFile(join(directory, "report.md"), markdown);
await writeFile(join(directory, "sideBySide.html"), sideBySideHtml(values.run, records, transcripts));
console.log(markdown);
console.error(`Written to ${join(directory, "report.md")} and ${join(directory, "sideBySide.html")}`);
