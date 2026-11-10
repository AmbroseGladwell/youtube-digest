import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { comparisonPaths, loadComparison } from "../comparisonPaths.js";
import { quotationsMarkdown, tallyQuotations } from "../quotationsMarkdown.js";

const USAGE = `usage: npm run quotations --workspace packages/model-comparison -- --run <name>

Reports the quotations in --run (OV-216): how many each note carries against its budget, how many
were named but dropped (outside their line, or too long to quote whole), and how much they add
to the spoken note. Reads notes that already exist: it spends nothing.`;

const { values } = parseArgs({ options: { run: { type: "string" } } });
if (!values.run) {
  console.error(USAGE);
  process.exit(1);
}

const { runs, byVideo } = await loadComparison(values.run);
const markdown = quotationsMarkdown(tallyQuotations(runs, byVideo), values.run);
const directory = comparisonPaths.quotationReports(values.run);
await mkdir(directory, { recursive: true });
const reportPath = join(directory, "report.md");
await writeFile(reportPath, markdown);
console.log(markdown);
console.error(`Written to ${reportPath}`);
