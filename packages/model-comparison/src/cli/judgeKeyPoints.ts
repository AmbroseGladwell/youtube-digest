import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { formatTimestamp } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparisonPaths, loadComparison, providerKeysFromEnv } from "../comparisonPaths.js";
import { jsonRecordStore, safePathPart } from "../jsonRecordStore.js";
import { judgeKeyPointsPair } from "../judgeKeyPointsPair.js";
import type { KeyPointsJudgeRecord } from "../KeyPointsJudgeRecord.js";
import { keyPointsJudgingMarkdown } from "../keyPointsJudgingMarkdown.js";
import { KEY_POINTS_RUBRIC_VERSION } from "../keyPointsRubric.js";
import { pairKey, promptPairs } from "../runJudging.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { spendWithinBudget, totalSpent } from "../spendWithinBudget.js";
import { videoLengthMs } from "../summariseRuns.js";

const USAGE = `usage: task secrets:run -- npm run judge-key-points --workspace packages/model-comparison -- \\
  --run <name> --against <earlier run> [--videos id,...] [--budget <dollars>] [--limit <pairs>] [--measure-only]

Judges only the key points of each model's note in --run against the same model's note in the
earlier run, once in each order. Reads videos from the main set and the coverage set, and
judges notes that already exist: it generates none.`;

const LANES = 4;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    against: { type: "string" },
    budget: { type: "string", default: "4" },
    limit: { type: "string" },
    videos: { type: "string" },
    "measure-only": { type: "boolean", default: false },
  },
});

const budgetDollars = Number(values.budget);
if (!values.run || !values.against || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}
const log = (line: string) => console.error(line);

const { runs, transcripts: mainSet } = await loadComparison(values.run);
const coverageFiles = (await readdir(comparisonPaths.coverageTranscripts).catch(() => [])).filter((file) => file.endsWith(".json"));
const coverageSet = await Promise.all(
  coverageFiles.map(async (file) => JSON.parse(await readFile(join(comparisonPaths.coverageTranscripts, file), "utf-8")) as FetchedTranscript),
);
const idOf = (fetched: FetchedTranscript) => fetched.video.id ?? fetched.video.url;
const byVideo = new Map([...mainSet, ...coverageSet].map((fetched) => [idOf(fetched), fetched] as const));
const transcripts = [...byVideo.values()].sort((left, right) => videoLengthMs(left) - videoLengthMs(right));
const against = await runDirectoryStore(comparisonPaths.run(values.against)).all();
const onlyVideos = values.videos?.split(",").map((id) => id.trim());
const allPairs = promptPairs(runs, against, byVideo).filter(
  (pair) => onlyVideos === undefined || onlyVideos.includes(pair.fetched.video.id ?? pair.fetched.video.url),
);
if (allPairs.length === 0) {
  console.error(`no pairs to judge: no video passed for the same model in both ${values.run} and ${values.against}`);
  process.exit(1);
}
const pairs = values.limit === undefined ? allPairs : allPairs.slice(0, Number(values.limit));

const directory = comparisonPaths.keyPointJudgments(values.run, values.against, KEY_POINTS_RUBRIC_VERSION);
const store = jsonRecordStore<KeyPointsJudgeRecord>(
  directory,
  (record) => `${safePathPart(record.candidate)}/${safePathPart(record.videoId)}.json`,
);

if (!values["measure-only"]) {
  const previous = await store.all();
  const settled = new Set(previous.filter((record) => record.outcome !== "errored").map((record) => pairKey(record.videoId, record.candidate)));
  const keys = providerKeysFromEnv();
  const tasks = pairs
    .filter((pair) => !settled.has(pairKey(pair.fetched.video.id ?? pair.fetched.video.url, pair.candidate.name)))
    .map((pair) => () => judgeKeyPointsPair({ ...pair, keys }));
  const outcome = await spendWithinBudget({
    lanes: Array.from({ length: LANES }, (_, lane) => tasks.filter((_, index) => index % LANES === lane)),
    budgetDollars,
    spentDollars: totalSpent(previous),
    save: store.save,
    describe: (record, spent) =>
      `${record.judge} judged ${record.videoId}: ${record.results?.overall ?? record.outcome}, ` +
      `$${(record.costDollars ?? 0).toFixed(4)} (spent $${spent.toFixed(4)} of $${budgetDollars.toFixed(2)})` +
      (record.error ? `\n    ${record.error.slice(0, 300)}` : ""),
    log,
  });
  if (outcome.stoppedForBudget) log(`Stopped at the $${budgetDollars.toFixed(2)} budget.`);
}

const videos = transcripts.filter((fetched) => onlyVideos === undefined || onlyVideos.includes(idOf(fetched))).map((fetched) => ({
  videoId: idOf(fetched),
  title: fetched.video.title,
  length: formatTimestamp(videoLengthMs(fetched)),
}));
const markdown = keyPointsJudgingMarkdown(await store.all(), videos, values.run, values.against, KEY_POINTS_RUBRIC_VERSION);
await mkdir(directory, { recursive: true });
const reportPath = join(directory, "report.md");
await writeFile(reportPath, markdown);
console.log(markdown);
log(`Written to ${reportPath}`);
