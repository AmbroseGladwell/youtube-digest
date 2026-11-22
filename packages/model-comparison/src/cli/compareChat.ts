import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { priceOf } from "@overview/generation";
import { comparisonPaths } from "../comparisonPaths.js";
import { CHAT_SOURCES, loadChatSource, type LoadedChatSource } from "../chat/chatSources.js";
import { CHAT_ARMS, chatSystemPrompt, chatUserMessage, type ChatArm } from "../chat/chatPrompt.js";
import { passageEmbeddings, questionEmbeddings } from "../chat/passageEmbeddings.js";
import { runChatConversation, type ChatConversationRecord } from "../chat/runChatConversation.js";
import { transcriptPassages } from "../chat/transcriptPassages.js";
import { spendWithinBudget } from "../spendWithinBudget.js";

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    models: { type: "string", default: "gpt-6-luna,gpt-6.1-sol" },
    arms: { type: "string", default: CHAT_ARMS.join(",") },
    repeats: { type: "string", default: "2" },
    window: { type: "string", default: "60" },
    count: { type: "string", default: "5" },
    budget: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const usage =
  "usage: task secrets:evals -- npm run chat --workspace packages/model-comparison -- --run <name> --budget <dollars> [--models a,b] [--arms a,b] [--repeats 2] [--window 60] [--count 5] [--dry-run]";
const models = values.models.split(",");
const arms = values.arms.split(",") as ChatArm[];
const repeats = Number(values.repeats);
const windowS = Number(values.window);
const retrieveCount = Number(values.count);
if (
  values.run === undefined ||
  arms.some((arm) => !CHAT_ARMS.includes(arm)) ||
  models.some((model) => priceOf({ provider: "openai", model }) === undefined)
) {
  console.error(usage);
  process.exit(1);
}

const sources = await Promise.all(CHAT_SOURCES.map(loadChatSource));

const roughTokens = (text: string) => Math.ceil(text.length / 4);
const roughConversationDollars = (source: LoadedChatSource, arm: ChatArm, model: string): number => {
  const price = priceOf({ provider: "openai", model });
  if (price === undefined) {
    return 0;
  }
  const passages = transcriptPassages(source.fetched.transcript, windowS * 1000);
  const system = roughTokens(chatSystemPrompt(arm, source.overview, passages));
  const averagePassage = passages.reduce((sum, passage) => sum + roughTokens(passage.text), 0) / Math.max(passages.length, 1);
  let history = 0;
  let dollars = 0;
  for (const question of source.questions.questions) {
    const user = roughTokens(chatUserMessage(arm, question.question, [])) + (arm === "fullTranscript" ? 0 : averagePassage * retrieveCount);
    const prompt = system + history + user;
    const output = 400;
    dollars += (prompt * price.perMillion.input + output * price.perMillion.output) / 1_000_000;
    history += user + 150;
  }
  return dollars;
};

if (values["dry-run"]) {
  let total = 0;
  for (const model of models) {
    for (const arm of arms) {
      const dollars = sources.reduce((sum, source) => sum + roughConversationDollars(source, arm, model), 0) * repeats;
      total += dollars;
      console.log(`${model.padEnd(14)} ${arm.padEnd(20)} ~$${dollars.toFixed(3)} uncached, ${repeats} repeat(s)`);
    }
  }
  console.log(`total ~$${total.toFixed(2)} at most, before caching (characters / 4; a rough ceiling, not a measurement)`);
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY;
const budgetDollars = Number(values.budget);
if (!apiKey || !(budgetDollars > 0)) {
  console.error(apiKey ? usage : "OPENAI_API_KEY is not set: run under task secrets:evals");
  process.exit(1);
}

const directory = join(comparisonPaths.chat, "runs", values.run);
await mkdir(directory, { recursive: true });
const done = new Set(await readdir(directory));
const spentDollars = (
  await Promise.all(
    [...done].map(async (file) => (JSON.parse(await readFile(join(directory, file), "utf-8")) as ChatConversationRecord).costDollars),
  )
).reduce((sum, cost) => sum + cost, 0);

const fileOf = (record: { overviewId: string; arm: string; model: string; repeat: number }) =>
  `${record.overviewId}--${record.arm}--${record.model}--${record.repeat}.json`;

const prepared = await Promise.all(
  sources.map(async (source) => {
    const passages = transcriptPassages(source.fetched.transcript, windowS * 1000);
    const passageVectors = (await passageEmbeddings(apiKey, source.overviewId, windowS * 1000, passages)).vectors;
    const questions = await questionEmbeddings(
      apiKey,
      source.overviewId,
      source.questions.questions.map((question) => question.question),
    );
    const perQuestion = questions.tokens / source.questions.questions.length;
    return {
      source,
      passages,
      passageVectors,
      questionVectors: questions.vectors,
      questionEmbeddingTokens: source.questions.questions.map(() => perQuestion),
    };
  }),
);

const lanes = models.map((model) =>
  prepared.flatMap((setup) =>
    arms.flatMap((arm) =>
      Array.from({ length: repeats }, (_, index) => index + 1)
        .filter((repeat) => !done.has(fileOf({ overviewId: setup.source.overviewId, arm, model, repeat })))
        .map((repeat) => () => runChatConversation({ apiKey, ...setup, arm, model, repeat, windowS, retrieveCount })),
    ),
  ),
);

const outcome = await spendWithinBudget<ChatConversationRecord>({
  lanes,
  budgetDollars,
  spentDollars,
  save: (record) => writeFile(join(directory, fileOf(record)), `${JSON.stringify(record, null, 2)}\n`),
  describe: (record, spent) => {
    const errors = record.turns.filter((turn) => turn.error !== null).length;
    return `${record.model.padEnd(14)} ${record.arm.padEnd(20)} ${record.overviewId.slice(0, 8)} #${record.repeat}  $${record.costDollars.toFixed(4)}${errors > 0 ? `  ${errors} error(s)` : ""}  (spent $${spent.toFixed(3)})`;
  },
  log: (line) => console.error(line),
});
console.error(
  `${outcome.ran} conversation(s), $${outcome.spentDollars.toFixed(3)} spent${outcome.stoppedForBudget ? ", stopped at the budget" : ""}`,
);
