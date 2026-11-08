import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, loadTranscripts, providerKeysFromEnv } from "../comparisonPaths.js";
import { actionsByVideo, readerSpread } from "../readerSpread.js";
import { readerSpreadMarkdown } from "../readerSpreadMarkdown.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { runOne } from "../runOne.js";
import { SPREAD_READERS } from "../spreadReaders.js";
import { spendWithinBudget, totalSpent } from "../spendWithinBudget.js";

const USAGE = `usage: task secrets:run -- npm run readers --workspace packages/model-comparison -- \\
  --run <name> [--budget <dollars>] [--limit <videos>] [--model provider:model]`;

const LANES = 4;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    budget: { type: "string", default: "2" },
    limit: { type: "string" },
    model: { type: "string", default: "openai:gpt-6.1-sol" },
  },
});

const budgetDollars = Number(values.budget);
if (!values.run || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}

const model = parseComparedModel(values.model);
const all = await loadTranscripts();
const transcripts = values.limit === undefined ? all : all.slice(0, Number(values.limit));
const apiKey = providerKeysFromEnv()[model.provider];
if (!apiKey) {
  console.error(`no ${model.provider} key in the environment`);
  process.exit(1);
}

const runDirectory = comparisonPaths.run(values.run);
const stores = new Map(SPREAD_READERS.map((reader) => [reader.name, runDirectoryStore(join(runDirectory, reader.name))]));
const everyRecord = async () => (await Promise.all([...stores.values()].map((store) => store.all()))).flat();
const log = (line: string) => console.error(line);

for (const reader of SPREAD_READERS) {
  const store = stores.get(reader.name)!;
  const done = new Set((await store.all()).filter((record) => record.outcome !== "errored").map((record) => record.videoId));
  const tasks = transcripts
    .filter((fetched) => !done.has(fetched.video.id ?? fetched.video.url))
    .map((fetched) => () => runOne({ model, apiKey, fetched, profile: { readerContext: reader.readerContext } }));
  const outcome = await spendWithinBudget({
    lanes: Array.from({ length: LANES }, (_, lane) => tasks.filter((_, index) => index % LANES === lane)),
    budgetDollars,
    spentDollars: totalSpent(await everyRecord()),
    save: store.save,
    describe: (record, spent) =>
      `${reader.name} ${record.videoId}: ${record.outcome}, $${(record.costDollars ?? 0).toFixed(4)} (spent $${spent.toFixed(4)} of $${budgetDollars.toFixed(2)})`,
    log,
  });
  if (outcome.stoppedForBudget) {
    log(`Stopped at the $${budgetDollars.toFixed(2)} budget during ${reader.name}.`);
    break;
  }
}

const wanted = new Set(transcripts.map((fetched) => fetched.video.id ?? fetched.video.url));
const runs = new Map(
  await Promise.all(
    SPREAD_READERS.map(async (reader) => [reader.name, (await stores.get(reader.name)!.all()).filter((record) => wanted.has(record.videoId))] as const),
  ),
);
const byVideo = actionsByVideo(runs);
const names = SPREAD_READERS.map((reader) => reader.name);
const markdown = readerSpreadMarkdown(
  SPREAD_READERS,
  readerSpread(names, byVideo),
  byVideo,
  new Map(all.map((fetched) => [fetched.video.id ?? fetched.video.url, fetched])),
);
await writeFile(join(runDirectory, "report.md"), markdown);
console.log(markdown);
console.error(`\n$${totalSpent(await everyRecord()).toFixed(4)} spent on run ${values.run} in all. Report: ${join(runDirectory, "report.md")}`);
