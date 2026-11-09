import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, loadTranscripts, providerKeysFromEnv } from "../comparisonPaths.js";
import { actionsByVideo, readerSpread } from "../readerSpread.js";
import { readerSpreadMarkdown } from "../readerSpreadMarkdown.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { runOne } from "../runOne.js";
import { actionJudgeFor, judgeActions, type ActionJudgeRecord } from "../judgeActions.js";
import { jsonRecordStore, safePathPart } from "../jsonRecordStore.js";
import { summariseActionJudgments } from "../summariseActionJudgments.js";
import { asBefore, BEFORE, READER_SETS, type ReaderSet, type SpreadReader } from "../spreadReaders.js";
import { isTranscriptSetName } from "../transcriptSet.js";
import { spendWithinBudget, totalSpent } from "../spendWithinBudget.js";

const USAGE = `usage: task secrets:run -- npm run readers --workspace packages/model-comparison -- \\
  --run <name> [--readers broad|specific|all] [--judge [--judge-model provider:model]] [--budget <dollars>] [--limit <videos>] [--model provider:model]
  [--videos main|parenting|main,parenting]
  [--against <earlier run>]   judge that run's readers beside this run's, in the same calls`;

const LANES = 4;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    readers: { type: "string", default: "broad" },
    judge: { type: "boolean", default: false },
    "judge-model": { type: "string" },
    budget: { type: "string", default: "2" },
    limit: { type: "string" },
    model: { type: "string", default: "openai:gpt-6.1-sol" },
    against: { type: "string" },
    videos: { type: "string", default: "main" },
  },
});

const budgetDollars = Number(values.budget);
const videoSets = values.videos.split(",");
if (
  !values.run ||
  !Number.isFinite(budgetDollars) ||
  budgetDollars <= 0 ||
  !(values.readers in READER_SETS) ||
  !videoSets.every(isTranscriptSetName)
) {
  console.error(USAGE);
  process.exit(1);
}
const SPREAD_READERS = READER_SETS[values.readers as ReaderSet];

const model = parseComparedModel(values.model);
const all = (await Promise.all(videoSets.filter(isTranscriptSetName).map((set) => loadTranscripts(set)))).flat();
const transcripts = values.limit === undefined ? all : all.slice(0, Number(values.limit));
const keys = providerKeysFromEnv();
const apiKey = keys[model.provider];
if (!apiKey) {
  console.error(`no ${model.provider} key in the environment`);
  process.exit(1);
}

const runDirectory = comparisonPaths.run(values.run);
const stores = new Map(SPREAD_READERS.map((reader) => [reader.name, runDirectoryStore(join(runDirectory, reader.name))]));
// Only readers who saw the reader context, and only those the earlier run has: nobody's
// prompt has no fit line, so its actions can't differ between the runs.
const beforeReaders: readonly SpreadReader[] =
  values.against === undefined
    ? []
    : SPREAD_READERS.filter(
        (reader) => reader.readerContext !== null && existsSync(join(comparisonPaths.run(values.against!), reader.name)),
      ).map(asBefore);
const beforeStores = new Map(
  beforeReaders.map((reader) => [
    reader.name,
    runDirectoryStore(join(comparisonPaths.run(values.against!), reader.name.slice(0, -BEFORE.length))),
  ]),
);
const judgedReaders = [...SPREAD_READERS, ...beforeReaders];
const judgments = jsonRecordStore<ActionJudgeRecord>(
  join(comparisonPaths.judgments(values.run), `actions-${values.readers}${values.against === undefined ? "" : `-vs-${values.against}`}`),
  (record) => `${safePathPart(record.judge)}/${safePathPart(record.videoId)}.json`,
);
const everyRecord = async () => [
  ...(await Promise.all([...stores.values()].map((store) => store.all()))).flat(),
  ...(await judgments.all()),
];
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
const allStores = new Map([...stores, ...beforeStores]);
const runs = new Map(
  await Promise.all(
    judgedReaders.map(
      async (reader) => [reader.name, (await allStores.get(reader.name)!.all()).filter((record) => wanted.has(record.videoId))] as const,
    ),
  ),
);
const byVideo = actionsByVideo(runs);
const names = judgedReaders.map((reader) => reader.name);
const transcriptsById = new Map(all.map((fetched) => [fetched.video.id ?? fetched.video.url, fetched]));

if (values.judge) {
  const judge = actionJudgeFor(model, values["judge-model"] === undefined ? null : parseComparedModel(values["judge-model"]));
  if (!keys[judge.provider]) {
    console.error(`no ${judge.provider} key in the environment for the judge`);
    process.exit(1);
  }
  const done = new Set((await judgments.all()).filter((record) => record.outcome !== "errored").map((record) => record.videoId));
  const tasks = [...byVideo]
    .filter(([videoId]) => !done.has(videoId))
    .map(
      ([videoId, actions]) =>
        () =>
          judgeActions({
            fetched: transcriptsById.get(videoId)!,
            readers: judgedReaders.map((reader) => ({ ...reader, actions: actions.get(reader.name) ?? [] })),
            writer: model,
            judge,
            keys,
          }),
    );
  const outcome = await spendWithinBudget({
    lanes: Array.from({ length: LANES }, (_, lane) => tasks.filter((_, index) => index % LANES === lane)),
    budgetDollars,
    spentDollars: totalSpent(await everyRecord()),
    save: judgments.save,
    describe: (record, spent) =>
      `judging ${record.videoId}: ${record.outcome}${record.error ? ` (${record.error.slice(0, 120)})` : ""}, $${(record.costDollars ?? 0).toFixed(4)} (spent $${spent.toFixed(4)} of $${budgetDollars.toFixed(2)})`,
    log,
  });
  if (outcome.stoppedForBudget) log(`Stopped at the $${budgetDollars.toFixed(2)} budget while judging.`);
}

const judgedRecords = (await judgments.all()).filter((record) => record.outcome === "judged" && byVideo.has(record.videoId));
const markdown = readerSpreadMarkdown(
  judgedReaders,
  readerSpread(names, byVideo),
  byVideo,
  transcriptsById,
  judgedRecords.length === 0 ? null : { judge: judgedRecords[0]!.judge, summaries: summariseActionJudgments(names, judgedRecords) },
);
await writeFile(join(runDirectory, "report.md"), markdown);
console.log(markdown);
console.error(
  `\n$${totalSpent(await everyRecord()).toFixed(4)} spent on run ${values.run} in all. Report: ${join(runDirectory, "report.md")}`,
);
