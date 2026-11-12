import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { NoteKind } from "@overview/domain";
import { checkNoteKind, createGenerationClient, kindSampleOfVideo, meteredFetch } from "@overview/generation";
import { comparedModelName, parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, loadTranscripts, providerKeysFromEnv } from "../comparisonPaths.js";
import { isTranscriptSetName } from "../transcriptSet.js";
import type { ActionableItemsRecord } from "../extractActionableItems.js";
import { jsonRecordStore, safePathPart } from "../jsonRecordStore.js";
import type { RunRecord } from "../RunRecord.js";
import { comparisonInput, measuredCost } from "../runOne.js";
import { spendWithinBudget } from "../spendWithinBudget.js";

const USAGE = `usage: task secrets:evals -- npm run kinds --workspace packages/model-comparison -- \\
  --run <name> --models provider:model,... [--budget <dollars>] [--judge provider:model] [--videos id,id]
  [--set recipes --expected-from <run>]

Runs the kind check alone and scores it. On the main set a video whose steps-check list has
items should be a process (OV-250); on another set, the kinds an earlier run's check answered
are what each video should still be.`;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    models: { type: "string" },
    budget: { type: "string", default: "0.2" },
    judge: { type: "string", default: "gemini:gemini-3.1-pro-preview" },
    videos: { type: "string" },
    set: { type: "string", default: "main" },
    "expected-from": { type: "string" },
  },
});
const budgetDollars = Number(values.budget);
if (
  !values.run ||
  !values.models ||
  !Number.isFinite(budgetDollars) ||
  budgetDollars <= 0 ||
  !isTranscriptSetName(values.set) ||
  (values.set !== "main" && values["expected-from"] === undefined)
) {
  console.error(USAGE);
  process.exit(1);
}

interface KindCheckRecord {
  videoId: string;
  model: string;
  noteKind: NoteKind | null;
  expected: NoteKind;
  error: string | null;
  costDollars: number | null;
}

const expectedOf = new Map<string, NoteKind>();
if (values["expected-from"] === undefined) {
  const listsDirectory = join(comparisonPaths.actionableItems, safePathPart(values.judge));
  for (const file of await readdir(listsDirectory)) {
    const list = JSON.parse(await readFile(join(listsDirectory, file), "utf-8")) as ActionableItemsRecord;
    if (list.items !== null) expectedOf.set(list.sourceId, list.items.length > 0 ? "process" : "default");
  }
} else {
  const runDirectory = comparisonPaths.run(values["expected-from"]);
  for (const writer of await readdir(runDirectory)) {
    for (const file of await readdir(join(runDirectory, writer))) {
      const record = JSON.parse(await readFile(join(runDirectory, writer, file), "utf-8")) as RunRecord;
      if (record.kindCheck?.noteKind != null) expectedOf.set(record.videoId, record.kindCheck.noteKind);
    }
  }
}

const keys = providerKeysFromEnv();
const chosen = values.videos === undefined ? null : new Set(values.videos.split(",").map((id) => id.trim()));
const transcripts = (await loadTranscripts(values.set)).filter(
  (fetched) => fetched.video.id !== null && expectedOf.has(fetched.video.id) && (chosen === null || chosen.has(fetched.video.id)),
);
const models = values.models.split(",").map((name) => parseComparedModel(name.trim()));
const store = jsonRecordStore<KindCheckRecord>(
  comparisonPaths.kindChecks(values.run),
  (record) => `${safePathPart(record.model)}/${record.videoId}.json`,
);

const settled = new Set((await store.all()).filter((record) => record.error === null).map((record) => `${record.model}:${record.videoId}`));
const outcome = await spendWithinBudget({
  lanes: models.map((model) =>
    transcripts
      .filter((fetched) => !settled.has(`${comparedModelName(model)}:${fetched.video.id}`))
      .map((fetched) => async (): Promise<KindCheckRecord> => {
        const metered = meteredFetch(model.provider, globalThis.fetch.bind(globalThis), () => performance.now());
        const client = createGenerationClient({ ...model, apiKey: keys[model.provider] ?? "", http: metered.http });
        const videoId = fetched.video.id!;
        const base = { videoId, model: comparedModelName(model), expected: expectedOf.get(videoId)! };
        try {
          const noteKind = await checkNoteKind(client, kindSampleOfVideo(comparisonInput(fetched)));
          return { ...base, noteKind, error: null, costDollars: measuredCost(model, metered.calls) };
        } catch (thrown) {
          return { ...base, noteKind: null, error: String(thrown), costDollars: measuredCost(model, metered.calls) };
        }
      }),
  ),
  budgetDollars,
  spentDollars: 0,
  save: store.save,
  describe: (record, total) =>
    `${record.model} ${record.videoId}: ${record.noteKind ?? record.error} (expected ${record.expected}), ` +
    `$${(record.costDollars ?? 0).toFixed(4)} (spent $${total.toFixed(4)} of $${budgetDollars.toFixed(2)})`,
  log: (line) => console.error(line),
});

const records = await store.all();
for (const model of models) {
  const mine = records.filter((record) => record.model === comparedModelName(model));
  const kinds = [...new Set(mine.map((record) => record.expected))].sort();
  console.log(
    `${comparedModelName(model)}: ` +
      kinds
        .map((kind) => {
          const these = mine.filter((record) => record.expected === kind);
          return `${these.filter((record) => record.noteKind === kind).length} of ${these.length} ${kind}`;
        })
        .join(", "),
  );
  for (const record of mine.filter((record) => record.noteKind !== record.expected)) {
    console.log(`  ${record.videoId}: ${record.noteKind ?? record.error} (expected ${record.expected})`);
  }
}
console.error(`$${outcome.spentDollars.toFixed(4)} spent.${outcome.stoppedForBudget ? " Stopped at the budget." : ""}`);
