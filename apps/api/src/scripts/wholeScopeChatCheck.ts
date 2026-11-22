import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  chatSourceKind,
  MAX_CHAT_PICKS,
  Overview,
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  overviewMarkdown,
  OverviewState,
  readStoredRecord,
  sameTopicName,
  stampSchemaVersion,
  Topic,
  TOPIC_MIGRATIONS,
  type ChatSourceKind,
} from "@overview/domain";
import { costInDollars, priceOf, promptTokensOf, tokenUsageOf, type TokenUsage } from "@overview/generation";
import { allIds, ANSWER_SHAPE_RULES, CHAT_REPLY_SCHEMA, ChatReply } from "../chats/ChatReply.js";
import { chatModel } from "../chats/chatModel.js";
import { libraryChatMaterial, PICK_SHAPE, pickedBlock, pickPrompt, SECTIONED_SHAPE } from "../chats/libraryChatPrompt.js";
import type { PromptMessage } from "../chats/streamChatCompletion.js";

// OV-373: does library chat answer from the whole scope when the map carries facts set by code,
// the reader's read and favourite state goes in beside it, and a first pass returns a plan (filters
// code applies, a mode, picks) rather than five picks? Over one reader's library (exportChatLibrary,
// which since OV-373 carries overview states and topics), against the shipped two passes.
//
//   node dist/scripts/wholeScopeChatCheck.js facts <data dir>
//   node dist/scripts/wholeScopeChatCheck.js run <data dir> <out.json> --arms shipped,plan5,plan-budget,plan-whole --runs 1 --budget 1 [--dry-run] [--only re]
//   node dist/scripts/wholeScopeChatCheck.js report <out.json>
//
// The data dir holds library/ from the export and questions.json. Each question's expected set is a
// filter applied by code, so what an answer should cover is never a model's judgement.

const ARMS = ["shipped", "plan5", "plan-budget", "plan-whole"] as const;
type ArmName = (typeof ARMS)[number];

const PLAN_TOKENS = 3_000;
const BROAD_ANSWER_TOKENS = 16_000;
const SHIPPED_ANSWER_CAP = SECTIONED_SHAPE.maxTokens;
const BUDGET_TOKENS = 40_000;
const BUDGET_PICKS = 20;
const WHOLE_CEILING_TOKENS = 300_000;
const WORDS_A_MINUTE = 238;
const CACHE_WRITE = 0.125 / 1e6;
const CACHED = 0.01 / 1e6;

const COUNTED =
  /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(of (these|the|your) )?(overviews|videos|recipes|sources|articles|episodes|items)\b/i;

interface Filter {
  read: "unread" | "read" | "any";
  favourite: "only" | "any";
  kinds: ChatSourceKind[];
  topics: string[];
  savedFrom: string;
  savedTo: string;
  novelty: Array<"common_knowledge" | "fresh_angle" | "original">;
}

const ANY: Filter = { read: "any", favourite: "any", kinds: [], topics: [], savedFrom: "", savedTo: "", novelty: [] };

interface Question {
  id: string;
  kind: "filtered" | "topic" | "ranking" | "deep";
  question: string;
  expect: Partial<Filter> | null;
  wantsAll: boolean;
  core: string[];
}

interface Entry {
  overview: Overview;
  read: boolean;
  favourite: boolean;
  topics: string[];
}

interface Library {
  entries: Entry[];
  topics: Topic[];
}

async function loadLibrary(dataDir: string): Promise<Library> {
  const raw = JSON.parse(await readFile(join(dataDir, "library", "library.json"), "utf-8")) as {
    overviews: Array<{ id: string; schemaVersion: number; body: unknown }>;
    overviewStates?: Array<{ schemaVersion: number; body: unknown }>;
    topics?: Array<{ schemaVersion: number; body: unknown }>;
  };
  if (raw.overviewStates === undefined || raw.topics === undefined)
    throw new Error("export again: this export has no overview states or topics");
  const stamp = (row: { schemaVersion: number; body: unknown }) =>
    stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion);
  const topics = raw.topics.flatMap((row) => {
    const read = readStoredRecord(stamp(row), Topic, TOPIC_MIGRATIONS);
    return read.status === "read" ? [read.record] : [];
  });
  const states = new Map(
    raw.overviewStates.flatMap((row) => {
      const read = readStoredRecord(stamp(row), OverviewState, OVERVIEW_STATE_MIGRATIONS);
      return read.status === "read" ? [[read.record.overviewId as string, read.record] as const] : [];
    }),
  );
  const entries = raw.overviews
    .map((row) => {
      const read = readStoredRecord(stamp(row), Overview, OVERVIEW_MIGRATIONS);
      if (read.status !== "read") throw new Error(`overview ${row.id} did not read: ${read.status}`);
      const state = states.get(read.record.id);
      return {
        overview: read.record,
        read: state?.read ?? false,
        favourite: state?.favourite ?? false,
        topics: read.record.topicIds.flatMap((id) => topics.find((topic) => topic.id === id)?.name ?? []),
      };
    })
    .sort((left, right) => left.overview.savedAt.localeCompare(right.overview.savedAt));
  return { entries, topics };
}

const minutesOf = ({ overview }: Entry): number | null => {
  const { source } = overview;
  if (source.kind === "web") return Math.max(1, Math.round(source.wordCount / WORDS_A_MINUTE));
  return source.durationMs === null ? null : Math.max(1, Math.round(source.durationMs / 60_000));
};

const matches = (entry: Entry, filter: Filter): boolean =>
  (filter.read === "any" || (filter.read === "unread") === !entry.read) &&
  (filter.favourite === "any" || entry.favourite) &&
  (filter.kinds.length === 0 || filter.kinds.includes(chatSourceKind(entry.overview))) &&
  (filter.topics.length === 0 || filter.topics.some((topic) => entry.topics.some((name) => sameTopicName(name, topic)))) &&
  (filter.savedFrom === "" || entry.overview.savedAt.slice(0, 10) >= filter.savedFrom) &&
  (filter.savedTo === "" || entry.overview.savedAt.slice(0, 10) <= filter.savedTo) &&
  (filter.novelty.length === 0 || (entry.overview.verdict !== null && filter.novelty.includes(entry.overview.verdict.novelty)));

const isAny = (filter: Filter) => JSON.stringify(filter) === JSON.stringify(ANY);

const factsLine = (entry: Entry): string => {
  const { overview } = entry;
  const minutes = minutesOf(entry);
  const kind = chatSourceKind(overview);
  return [
    kind,
    minutes === null ? null : `${minutes} min ${kind === "article" || kind === "recipe" ? "read" : ""}`.trim(),
    `saved ${overview.savedAt.slice(0, 10)}`,
    overview.verdict === null ? null : overview.verdict.novelty.replace("_", " "),
    overview.verdict?.dubious === true ? "dubious" : null,
    overview.watchAnyway === null ? null : `watch it anyway: ${overview.watchAnyway.answer}`,
    entry.topics.length === 0 ? null : `topics: ${entry.topics.join(", ")}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
};

const factsEntry = (label: string, entry: Entry): string => {
  const { overview } = entry;
  const ingredients = overview.recipe === null ? "" : `Ingredients: ${overview.recipe.ingredients.slice(0, 12).join("; ")}`;
  return [`## [${label}] ${overview.source.title}`, factsLine(entry), overview.bigPicture ?? "", overview.coreClaim, ingredients]
    .filter((line) => line !== "")
    .join("\n");
};

const whole = (label: string, entry: Entry) =>
  `## [${label}]\n\n${overviewMarkdown(entry.overview, { partIds: true, partIdPrefix: `${label}.` })}`;

const tokensOf = (text: string) => Math.ceil(text.length / 4);

const SHAPE_AND_RULES = `${ANSWER_SHAPE_RULES}

Rules:
- A source is an overview's id, or an item's id from the full notes, such as O12.kp3. A section that compares or connects overviews lists every one of them.
- Name overviews by their titles only where the sentence needs it; the sources carry the citation.
- Never give a count of overviews or sources, or a share of them, in words or figures ("two sources", "three of your recipes"): say "a couple", "several" or "most" instead.
- Use only what the overviews say. Where you connect them, say it is your connection, not theirs.
- When nothing here covers the question, say so in the intro and leave sections empty.
- There is no single source here: always set inSource to false, and set generalKnowledge to false unless you add something from beyond these overviews, which you mark as such.`;

function planSystem(library: Library, labels: Map<string, Entry>): string {
  return `You answer a reader's questions about their whole library in The Overview: every overview they have saved, listed below in brief. Each overview has an id (O1, O2 and so on) and shows its title; a line of facts (its kind, its length, the day it was saved, how new its ideas are, whether its claims are dubious, whether it is worth watching anyway, and its topics); its big picture and its core claim. A recipe shows its ingredients. The reader's read and favourite marks follow in a message of their own.

Before answering you are asked for a plan:
- filters: narrow the overviews to the ones the question is about, using only these: read ("unread", "read" or "any"), favourite ("only" or "any"), kinds (video, article, recipe, episode), topics (exact names from the list below), savedFrom and savedTo (YYYY-MM-DD, or empty), novelty (common_knowledge, fresh_angle, original). Leave a filter at "any" or empty unless the question asks for it. Code applies them exactly.
- mode: "broad" when the answer has to cover, sort or rank many overviews (every unread one, every one on a topic); "deep" when it rests on a few.
- picks: the overviews whose full notes the answer needs. You may then be given those overviews in full, with their items' ids (such as O12.kp3), and the ids code kept after your filters.

When the answer is broad, every overview in the scope code gives you must appear in the sources of a list item somewhere in the answer, so none is left out. Group them: one list item may carry many sources when they share a reason, and the overviews read in full can carry their own items with reasons.

${SHAPE_AND_RULES}

# Topics

${library.topics.map((topic) => topic.name).join("; ")}

# The overviews

${[...labels].map(([label, entry]) => factsEntry(label, entry)).join("\n\n")}`;
}

const readerState = (labels: Map<string, Entry>): PromptMessage => {
  const ids = (keep: (entry: Entry) => boolean) =>
    [...labels]
      .filter(([, entry]) => keep(entry))
      .map(([label]) => label)
      .join(", ");
  return {
    role: "user",
    content: `The reader's marks. Unread: ${ids((entry) => !entry.read) || "none"}.\nFavourites: ${ids((entry) => entry.favourite) || "none"}.`,
  };
};

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["filters", "mode", "picks"],
  properties: {
    filters: {
      type: "object",
      additionalProperties: false,
      required: ["read", "favourite", "kinds", "topics", "savedFrom", "savedTo", "novelty"],
      properties: {
        read: { type: "string", enum: ["unread", "read", "any"] },
        favourite: { type: "string", enum: ["only", "any"] },
        kinds: { type: "array", items: { type: "string", enum: ["video", "article", "recipe", "episode"] } },
        topics: { type: "array", items: { type: "string" } },
        savedFrom: { type: "string" },
        savedTo: { type: "string" },
        novelty: { type: "array", items: { type: "string", enum: ["common_knowledge", "fresh_angle", "original"] } },
      },
    },
    mode: { type: "string", enum: ["deep", "broad"] },
    picks: { type: "array", items: { type: "string" } },
  },
} as const;

interface Plan {
  filters: Filter;
  mode: "deep" | "broad";
  picks: string[];
}

const planPrompt = (question: string, most: number): PromptMessage => ({
  role: "user",
  content: `Plan the answer to this question. Pick up to ${most} overviews to read in full, the ones the answer will rest on: ${question}`,
});

const scopeBlock = (scope: readonly string[], filtered: boolean): PromptMessage => ({
  role: "user",
  content: filtered
    ? `The scope code kept after your filters: ${scope.join(", ") || "none"}. Answer from these alone.`
    : "Your filters kept the whole library.",
});

async function completeJson(
  apiKey: string,
  messages: PromptMessage[],
  schema: object,
  maxTokens: number,
  cacheKey: string,
): Promise<{ json: unknown; usage: TokenUsage | null }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: chatModel.model,
      max_completion_tokens: maxTokens,
      messages,
      prompt_cache_key: cacheKey,
      response_format: { type: "json_schema", json_schema: { name: "reply", strict: true, schema } },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) throw new Error(`The provider answered ${response.status}`);
  const body = (await response.json()) as { choices: Array<{ message: { content: string | null }; finish_reason: string }> };
  const usage = tokenUsageOf("openai", body);
  const choice = body.choices[0]!;
  if (choice.finish_reason === "length") throw Object.assign(new Error("cut off at the answer cap"), { usage });
  return { json: JSON.parse(choice.message.content ?? ""), usage };
}

const addUsage = (left: TokenUsage | null, right: TokenUsage | null): TokenUsage | null =>
  left === null
    ? right
    : right === null
      ? left
      : {
          uncachedInputTokens: left.uncachedInputTokens + right.uncachedInputTokens,
          cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
          cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
          outputTokens: left.outputTokens + right.outputTokens,
        };

interface Turn {
  arm: ArmName;
  run: number;
  id: string;
  kind: Question["kind"];
  failed: boolean;
  error: string | null;
  plan: Plan | null;
  scopeSize: number;
  expectedSize: number | null;
  scopeMatchesExpected: boolean | null;
  readInFull: number;
  readInFullTokens: number;
  cited: string[];
  covered: number | null;
  outside: number | null;
  coreFound: number | null;
  coreTotal: number;
  invalidIds: number;
  gaveCount: boolean;
  passOneOutputTokens: number;
  answerOutputTokens: number;
  overShippedCap: boolean;
  inputTokens: number;
  cachedTokens: number;
  costDollars: number;
  ms: number;
  reply: ChatReply | null;
}

const resolvedFilter = (filter: Partial<Filter>): Filter => ({ ...ANY, ...filter });

async function loadQuestions(dataDir: string, library: Library): Promise<Question[]> {
  const questions = (JSON.parse(await readFile(join(dataDir, "questions.json"), "utf-8")) as { questions: Question[] }).questions;
  for (const question of questions) {
    question.core = question.core.map((prefix) => {
      const found = library.entries.find((entry) => entry.overview.id.startsWith(prefix));
      if (found === undefined) throw new Error(`${question.id}: no overview ${prefix}`);
      return found.overview.id;
    });
    for (const topic of question.expect?.topics ?? []) {
      if (!library.topics.some((each) => sameTopicName(each.name, topic))) throw new Error(`${question.id}: no topic ${topic}`);
    }
  }
  return questions;
}

async function facts(dataDir: string): Promise<void> {
  const library = await loadLibrary(dataDir);
  const count = (keep: (entry: Entry) => boolean) => library.entries.filter(keep).length;
  console.log(
    `${library.entries.length} overviews, ${count((entry) => !entry.read)} unread, ${count((entry) => entry.favourite)} favourites`,
  );
  const kinds = new Map<string, number>();
  for (const entry of library.entries) kinds.set(chatSourceKind(entry.overview), (kinds.get(chatSourceKind(entry.overview)) ?? 0) + 1);
  console.log(`kinds: ${[...kinds].map(([kind, n]) => `${kind} ${n}`).join(", ")}`);
  const months = new Map<string, number>();
  for (const entry of library.entries)
    months.set(entry.overview.savedAt.slice(0, 7), (months.get(entry.overview.savedAt.slice(0, 7)) ?? 0) + 1);
  console.log(`saved: ${[...months].map(([month, n]) => `${month} ${n}`).join(", ")}`);
  console.log("topics:");
  for (const topic of library.topics) {
    const held = library.entries.filter((entry) => entry.topics.includes(topic.name));
    console.log(`  ${topic.name}: ${held.length} (${held.filter((entry) => !entry.read).length} unread)`);
  }
  const labels = new Map(library.entries.map((entry, index) => [`O${index + 1}`, entry]));
  console.log(
    `plan map about ${tokensOf(planSystem(library, labels))} tokens; whole library about ${tokensOf(library.entries.map((entry, i) => whole(`O${i + 1}`, entry)).join("\n\n"))}`,
  );
}

async function run(
  dataDir: string,
  outPath: string,
  options: { arms: ArmName[]; runs: number; budget: number; dryRun: boolean; only: string | null },
): Promise<void> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!options.dryRun && !apiKey) throw new Error("OPENAI_API_KEY is needed");
  const library = await loadLibrary(dataDir);
  const questions = await loadQuestions(dataDir, library);
  const price = priceOf(chatModel)!;
  const labels = new Map(library.entries.map((entry, index) => [`O${index + 1}`, entry]));
  const idOf = (label: string): string | null => labels.get(label.split(".")[0]!)?.overview.id ?? null;
  const shipped = libraryChatMaterial(
    { kind: "library" },
    library.entries.map((entry) => entry.overview),
  );
  if (shipped.mode !== "map") throw new Error("this library goes whole: the comparison needs the map");
  const system = planSystem(library, labels);
  const done: Turn[] = JSON.parse((await readFile(outPath, "utf-8").catch(() => "[]")) as string) as Turn[];
  let spent = done.reduce((total, turn) => total + turn.costDollars, 0);
  let ceiling = 0;

  for (const armName of options.arms) {
    for (let r = 1; r <= options.runs; r += 1) {
      for (const question of questions) {
        if (options.only !== null && !new RegExp(options.only).test(question.id)) continue;
        if (done.some((turn) => turn.arm === armName && turn.run === r && turn.id === question.id)) continue;
        const expected =
          question.expect === null
            ? null
            : library.entries.filter((entry) => matches(entry, resolvedFilter(question.expect!))).map((entry): string => entry.overview.id);
        if (options.dryRun) {
          const map = tokensOf(armName === "shipped" ? shipped.system : system);
          const filtered = expected ?? library.entries.map((entry): string => entry.overview.id);
          const wholeTokens =
            armName === "plan-whole"
              ? Math.min(
                  WHOLE_CEILING_TOKENS,
                  tokensOf(
                    [...labels]
                      .filter(([, entry]) => filtered.includes(entry.overview.id))
                      .map(([label, entry]) => whole(label, entry))
                      .join("\n\n"),
                  ),
                )
              : armName === "plan-budget"
                ? BUDGET_TOKENS
                : 2_300 * MAX_CHAT_PICKS;
          const output = question.wantsAll ? 6_000 : 2_500;
          const cost = map * CACHE_WRITE + map * CACHED + wholeTokens * CACHE_WRITE + (1_000 + output) * (price.perMillion.output / 1e6);
          ceiling += cost;
          if (r === 1) console.log(`${armName} ${question.id}: map ${map}, full notes ${wholeTokens}, about $${cost.toFixed(4)}`);
          continue;
        }
        if (spent >= options.budget) {
          console.error(`budget of $${options.budget} reached at $${spent.toFixed(4)}`);
          break;
        }
        const startedAt = Date.now();
        const key = `ov373-${armName}`;
        let usage: TokenUsage | null = null;
        let plan: Plan | null = null;
        let scope: string[] = library.entries.map((entry): string => entry.overview.id);
        let readLabels: string[] = [];
        let readTokens = 0;
        let passOneOutput = 0;
        let turn: Turn;
        try {
          let messages: PromptMessage[];
          let answerCap: number;
          if (armName === "shipped") {
            messages = [{ role: "system", content: shipped.system }];
            const pick = await completeJson(
              apiKey!,
              [...messages, pickPrompt(question.question)],
              PICK_SHAPE.schema,
              PICK_SHAPE.maxTokens,
              key,
            );
            usage = addUsage(usage, pick.usage);
            passOneOutput = pick.usage?.outputTokens ?? 0;
            readLabels = [...new Set((pick.json as { overviews: string[] }).overviews.map((id) => id.split(".")[0]!))]
              .filter((label) => shipped.labels.has(label))
              .slice(0, MAX_CHAT_PICKS);
            const block = pickedBlock(readLabels.map((label) => [label, shipped.labels.get(label)!] as const));
            readTokens = tokensOf(block.content);
            messages.push(block);
            answerCap = SHIPPED_ANSWER_CAP;
          } else {
            messages = [{ role: "system", content: system }, readerState(labels)];
            const most = armName === "plan5" ? MAX_CHAT_PICKS : BUDGET_PICKS;
            const planned = await completeJson(apiKey!, [...messages, planPrompt(question.question, most)], PLAN_SCHEMA, PLAN_TOKENS, key);
            usage = addUsage(usage, planned.usage);
            passOneOutput = planned.usage?.outputTokens ?? 0;
            plan = planned.json as Plan;
            const filter = resolvedFilter(plan.filters);
            const kept = [...labels].filter(([, entry]) => matches(entry, filter));
            scope = kept.map(([, entry]): string => entry.overview.id);
            const filtered = !isAny(filter);
            const picks = [...new Set(plan.picks.map((id) => id.split(".")[0]!))].filter((label) => labels.has(label));
            if (armName === "plan-whole" && filtered) {
              const all = kept.map(([label, entry]) => [label, whole(label, entry)] as const);
              const total = tokensOf(all.map(([, text]) => text).join("\n\n"));
              readLabels = total <= WHOLE_CEILING_TOKENS ? all.map(([label]) => label) : picks.slice(0, BUDGET_PICKS);
            } else if (armName === "plan5") {
              readLabels = picks.slice(0, MAX_CHAT_PICKS);
            } else {
              for (const label of picks.slice(0, BUDGET_PICKS)) {
                const tokens = tokensOf(whole(label, labels.get(label)!));
                if (readTokens + tokens > BUDGET_TOKENS) break;
                readTokens += tokens;
                readLabels.push(label);
              }
            }
            const notes = readLabels.map((label) => whole(label, labels.get(label)!)).join("\n\n");
            readTokens = tokensOf(notes);
            messages.push(
              scopeBlock(
                kept.map(([label]) => label),
                filtered,
              ),
            );
            if (readLabels.length > 0) messages.push({ role: "user", content: `The full notes of the overviews you chose:\n\n${notes}` });
            answerCap = plan.mode === "broad" ? BROAD_ANSWER_TOKENS : SHIPPED_ANSWER_CAP;
          }
          messages.push({ role: "user", content: question.question });
          const answered = await completeJson(apiKey!, messages, CHAT_REPLY_SCHEMA, answerCap, key);
          usage = addUsage(usage, answered.usage);
          const reply = ChatReply.parse(answered.json);
          const ids = allIds(reply);
          const cited = [...new Set(ids.flatMap((id) => idOf(id) ?? []))];
          const allText = [
            reply.intro,
            ...reply.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...[...s.numbered, ...s.bullets].map((i) => i.text)]),
            reply.takeaway,
          ].join(" ");
          const answerOutput = answered.usage?.outputTokens ?? 0;
          turn = {
            arm: armName,
            run: r,
            id: question.id,
            kind: question.kind,
            failed: false,
            error: null,
            plan,
            scopeSize: scope.length,
            expectedSize: expected?.length ?? null,
            scopeMatchesExpected:
              expected === null || armName === "shipped"
                ? null
                : expected.length === scope.length && expected.every((id) => scope.includes(id)),
            readInFull: readLabels.length,
            readInFullTokens: readTokens,
            cited,
            covered: expected === null || !question.wantsAll ? null : expected.filter((id) => cited.includes(id)).length,
            outside: expected === null ? null : cited.filter((id) => !expected.includes(id)).length,
            coreFound: question.core.length === 0 ? null : question.core.filter((id) => cited.includes(id)).length,
            coreTotal: question.core.length,
            invalidIds: ids.filter((id) => idOf(id) === null).length,
            gaveCount: COUNTED.test(allText),
            passOneOutputTokens: passOneOutput,
            answerOutputTokens: answerOutput,
            overShippedCap: answerOutput > SHIPPED_ANSWER_CAP,
            inputTokens: usage === null ? 0 : promptTokensOf(usage),
            cachedTokens: usage?.cachedInputTokens ?? 0,
            costDollars: usage === null ? 0 : costInDollars(price, usage),
            ms: Date.now() - startedAt,
            reply,
          };
        } catch (error) {
          usage = addUsage(usage, (error as { usage?: TokenUsage | null }).usage ?? null);
          turn = {
            arm: armName,
            run: r,
            id: question.id,
            kind: question.kind,
            failed: true,
            error: error instanceof Error ? error.message : String(error),
            plan,
            scopeSize: scope.length,
            expectedSize: expected?.length ?? null,
            scopeMatchesExpected: null,
            readInFull: readLabels.length,
            readInFullTokens: readTokens,
            cited: [],
            covered: null,
            outside: null,
            coreFound: null,
            coreTotal: question.core.length,
            invalidIds: 0,
            gaveCount: false,
            passOneOutputTokens: passOneOutput,
            answerOutputTokens: 0,
            overShippedCap: false,
            inputTokens: usage === null ? 0 : promptTokensOf(usage),
            cachedTokens: usage?.cachedInputTokens ?? 0,
            costDollars: usage === null ? 0 : costInDollars(price, usage),
            ms: Date.now() - startedAt,
            reply: null,
          };
        }
        done.push(turn);
        spent += turn.costDollars;
        await writeFile(outPath, `${JSON.stringify(done, null, 1)}\n`);
        console.error(
          `${armName} r${r} ${question.id} ${turn.failed ? `FAILED ${turn.error}` : `$${turn.costDollars.toFixed(4)} scope ${turn.scopeSize}${turn.expectedSize === null ? "" : `/${turn.expectedSize}`} read ${turn.readInFull} cited ${turn.cited.length}${turn.covered === null ? "" : ` covered ${turn.covered}/${turn.expectedSize}`} out ${turn.answerOutputTokens} ${(turn.ms / 1000).toFixed(1)}s`}`,
        );
      }
    }
  }
  if (options.dryRun) {
    console.log(`dry run: about $${ceiling.toFixed(2)} for ${options.runs} run(s)`);
    return;
  }
  console.log(report(done));
  console.error(`spent $${spent.toFixed(4)} in all`);
}

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

function report(turns: Turn[]): string {
  const arms = ARMS.filter((arm) => turns.some((turn) => turn.arm === arm));
  const kinds = [...new Set(turns.map((turn) => turn.kind))];
  const ratio = (subset: Turn[], top: (turn: Turn) => number | null, bottom: (turn: Turn) => number | null) => {
    const kept = subset.filter((turn) => top(turn) !== null && bottom(turn) !== null);
    return kept.length === 0 ? "—" : `${kept.reduce((t, x) => t + top(x)!, 0)}/${kept.reduce((t, x) => t + bottom(x)!, 0)}`;
  };
  const rows = arms.map((arm) => {
    const all = turns.filter((turn) => turn.arm === arm);
    const ok = all.filter((turn) => !turn.failed);
    return `| ${arm} | ${all.length} | ${all.length - ok.length} | ${ratio(
      ok,
      (t) => t.covered,
      (t) => (t.covered === null ? null : t.expectedSize),
    )} | ${ok.reduce((t, x) => t + (x.outside ?? 0), 0)} | ${ok.filter((t) => t.scopeMatchesExpected === true).length}/${ok.filter((t) => t.scopeMatchesExpected !== null).length} | ${ratio(
      ok,
      (t) => t.coreFound,
      (t) => (t.coreFound === null ? null : t.coreTotal),
    )} | ${median(ok.map((t) => t.readInFull))} | ${ok.filter((t) => t.overShippedCap).length} | ${median(ok.map((t) => t.answerOutputTokens))} | ${ok.reduce((t, x) => t + x.invalidIds, 0)} | ${ok.filter((t) => t.gaveCount).length} | ${median(ok.map((t) => t.inputTokens))} | $${median(ok.map((t) => t.costDollars)).toFixed(4)} | $${Math.max(0, ...ok.map((t) => t.costDollars)).toFixed(4)} | ${(median(ok.map((t) => t.ms)) / 1000).toFixed(1)} s |`;
  });
  const byKind = kinds.flatMap((kind) =>
    arms.map((arm) => {
      const ok = turns.filter((turn) => turn.arm === arm && turn.kind === kind && !turn.failed);
      return `| ${kind} | ${arm} | ${ratio(
        ok,
        (t) => t.covered,
        (t) => (t.covered === null ? null : t.expectedSize),
      )} | ${ok.reduce((t, x) => t + (x.outside ?? 0), 0)} | ${ratio(
        ok,
        (t) => t.coreFound,
        (t) => (t.coreFound === null ? null : t.coreTotal),
      )} | $${median(ok.map((t) => t.costDollars)).toFixed(4)} |`;
    }),
  );
  return [
    "| Arm | Answers | Failed | Covered (wants all) | Cited outside the scope | Scope = expected | Core found | Read in full (median) | Over 4,000 output | Output tokens | Bad ids | Gave a count | Prompt tokens | Cost (median) | Cost (max) | Latency |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "| Kind | Arm | Covered | Outside | Core found | Cost (median) |",
    "| --- | --- | --- | --- | --- | --- |",
    ...byKind,
  ].join("\n");
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    arms: { type: "string", default: ARMS.join(",") },
    runs: { type: "string", default: "1" },
    budget: { type: "string", default: "1" },
    only: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const [command, first, second] = positionals;
if (command === "facts" && first) {
  await facts(first);
} else if (command === "run" && first && second) {
  const arms = values.arms.split(",");
  for (const arm of arms) if (!(ARMS as readonly string[]).includes(arm)) throw new Error(`no arm ${arm}: ${ARMS.join(", ")}`);
  await run(first, second, {
    arms: arms as ArmName[],
    runs: Number(values.runs),
    budget: Number(values.budget),
    dryRun: values["dry-run"],
    only: values.only ?? null,
  });
} else if (command === "report" && first) {
  console.log(report(JSON.parse(await readFile(first, "utf-8")) as Turn[]));
} else {
  console.error(
    "usage: wholeScopeChatCheck facts <data dir> | run <data dir> <out.json> --arms a,b [--runs 1] [--budget 1] [--dry-run] | report <out.json>",
  );
  process.exit(1);
}
