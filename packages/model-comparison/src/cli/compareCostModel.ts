import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, loadTranscripts, providerKeysFromEnv } from "../comparisonPaths.js";
import { costModelMarkdown } from "../costModelMarkdown.js";
import { jsonRecordStore, safePathPart } from "../jsonRecordStore.js";
import { judgePersonalPair, type PersonalJudgeRecord } from "../judgePersonalPair.js";
import { loadSampleReader } from "../ReaderProfile.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { runOne } from "../runOne.js";
import { runPersonalPass } from "../runPersonalPass.js";
import { isPassed } from "../summariseRuns.js";
import { spendWithinBudget, totalSpent, type Spend } from "../spendWithinBudget.js";

const USAGE = `usage: task secrets:run -- npm run cost-model --workspace packages/model-comparison -- \\
  --run <name> --stage-one-run <OV-92 run> [--budget <dollars>] [--limit <videos>] [--model provider:model]`;

const LANES = 4;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    "stage-one-run": { type: "string" },
    budget: { type: "string", default: "2" },
    limit: { type: "string" },
    model: { type: "string", default: "openai:gpt-6.1-sol" },
  },
});

const budgetDollars = Number(values.budget);
if (!values.run || !values["stage-one-run"] || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}

const model = parseComparedModel(values.model);
const all = await loadTranscripts();
const transcripts = values.limit === undefined ? all : all.slice(0, Number(values.limit));
const byVideo = new Map(all.map((fetched) => [fetched.video.id ?? fetched.video.url, fetched]));
const profile = await loadSampleReader();
const keys = providerKeysFromEnv();
const apiKey = keys[model.provider];
if (!apiKey) {
  console.error(`no ${model.provider} key in the environment`);
  process.exit(1);
}

const runDirectory = comparisonPaths.run(values.run);
const stores = {
  single: runDirectoryStore(join(runDirectory, "single")),
  "personal-from-note": runDirectoryStore(join(runDirectory, "personal-from-note")),
  "personal-with-transcript": runDirectoryStore(join(runDirectory, "personal-with-transcript")),
};
const judgments = jsonRecordStore<PersonalJudgeRecord>(
  comparisonPaths.judgments(values.run),
  (record) => `${safePathPart(record.candidate)}/${safePathPart(record.videoId)}.json`,
);
const stageOne = (await runDirectoryStore(comparisonPaths.run(values["stage-one-run"])).all()).filter(
  (record) => record.provider === model.provider && record.model === model.model,
);

const spentSoFar = async () =>
  totalSpent([
    ...(await stores.single.all()),
    ...(await stores["personal-from-note"].all()),
    ...(await stores["personal-with-transcript"].all()),
    ...(await judgments.all()),
  ]);

const settled = (records: readonly { videoId: string; outcome: string }[]) =>
  new Set(records.filter((record) => record.outcome !== "errored").map((record) => record.videoId));

const inLanes = <T>(tasks: T[]): T[][] =>
  Array.from({ length: LANES }, (_, lane) => tasks.filter((_, index) => index % LANES === lane));

const log = (line: string) => console.error(line);

async function spend<R extends Spend & { videoId: string; outcome: string }>(phase: string, tasks: (() => Promise<R>)[], save: (record: R) => Promise<void>) {
  const outcome = await spendWithinBudget({
    lanes: inLanes(tasks),
    budgetDollars,
    spentDollars: await spentSoFar(),
    save,
    describe: (record, spent) =>
      `${phase} ${record.videoId}: ${record.outcome}, $${(record.costDollars ?? 0).toFixed(4)} (spent $${spent.toFixed(4)} of $${budgetDollars.toFixed(2)})`,
    log,
  });
  if (outcome.stoppedForBudget) {
    log(`Stopped at the $${budgetDollars.toFixed(2)} budget during ${phase}.`);
    return false;
  }
  return true;
}

const doneSingle = settled(await stores.single.all());
const carriedOn = await spend(
  "single pass",
  transcripts
    .filter((fetched) => !doneSingle.has(fetched.video.id ?? fetched.video.url))
    .map((fetched) => () => runOne({ model, apiKey, fetched, profile })),
  stores.single.save,
);

const singles = (await stores.single.all()).filter((record) => isPassed(record) && record.overview !== null);
const wanted = new Set(transcripts.map((fetched) => fetched.video.id ?? fetched.video.url));

if (carriedOn) {
  for (const arm of ["personal-from-note", "personal-with-transcript"] as const) {
    const done = settled(await stores[arm].all());
    await spend(
      arm,
      singles
        .filter((record) => wanted.has(record.videoId) && !done.has(record.videoId))
        .map(
          (record) => () =>
            runPersonalPass({
              model,
              apiKey,
              fetched: byVideo.get(record.videoId)!,
              profile,
              shared: record.overview!,
              withTranscript: arm === "personal-with-transcript",
            }),
        ),
      stores[arm].save,
    );
  }

  for (const arm of ["personal-from-note", "personal-with-transcript"] as const) {
    const done = new Set(
      (await judgments.all())
        .filter((record) => record.candidate === arm && record.outcome !== "errored")
        .map((record) => record.videoId),
    );
    const candidates = new Map((await stores[arm].all()).filter(isPassed).map((record) => [record.videoId, record]));
    await spend(
      `judging ${arm}`,
      singles
        .filter((record) => wanted.has(record.videoId) && candidates.has(record.videoId) && !done.has(record.videoId))
        .map(
          (record) => () =>
            judgePersonalPair({
              fetched: byVideo.get(record.videoId)!,
              profile,
              baseline: { name: "single", record },
              candidate: { name: arm, record: candidates.get(record.videoId)! },
              keys,
            }),
        ),
      judgments.save,
    );
  }
}

const markdown = costModelMarkdown(
  {
    stageOne,
    single: await stores.single.all(),
    personalFromNote: await stores["personal-from-note"].all(),
    personalWithTranscript: await stores["personal-with-transcript"].all(),
  },
  await judgments.all(),
  byVideo,
);
await writeFile(join(runDirectory, "report.md"), markdown);
console.log(markdown);
console.error(`\n$${(await spentSoFar()).toFixed(4)} spent on run ${values.run} in all. Report: ${join(runDirectory, "report.md")}`);

