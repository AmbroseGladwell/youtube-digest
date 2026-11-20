import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  chatSourceKind,
  Overview,
  OVERVIEW_MIGRATIONS,
  overviewMarkdown,
  overviewPartId,
  overviewParts,
  readStoredRecord,
  sourceKey,
  stampSchemaVersion,
  StoredTranscript,
  formatClock,
  type TranscriptSegment,
} from "@overview/domain";
import { costInDollars, priceOf, promptTokensOf, type TokenUsage } from "@overview/generation";
import { AccountId } from "../auth/AccountId.js";
import { ChatReply } from "../chats/ChatReply.js";
import { chatModel } from "../chats/chatModel.js";
import { chatSystemPrompt } from "../chats/chatPrompt.js";
import { streamChatCompletion, type PromptMessage } from "../chats/streamChatCompletion.js";
import { transcriptPassages, type Passage } from "../chats/transcriptPassages.js";
import { withoutCitationMarks } from "../chats/withoutCitationMarks.js";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { ClaimEmbeddingsRepository } from "../meaning/ClaimEmbeddingsRepository.js";
import { createOpenAiEmbedder } from "../meaning/createOpenAiEmbedder.js";
import { MEANING_FLOOR } from "../meaning/MeaningSearch.js";
import { createTestPglite } from "../testing/createTestPglite.testHelper.js";

// OV-307: chat across sources. Over one reader's whole library (exportChatLibrary), does search
// by meaning find the overview that answers a question, and what does an answer cost and how
// good is it when the closest few, or overviews the reader pins, go in beside the one the chat
// is about (docs/architecture/in-app-chat.md, "Chat across sources").
//
//   node dist/scripts/chatAcrossSourcesCheck.js retrieval <data dir> <out.json>
//   node dist/scripts/chatAcrossSourcesCheck.js answer <data dir> <retrieval.json> <out.json> --arms a,b --runs 2 --budget 3 [--dry-run]
//
// retrieval spends only embeddings: the questions, and every transcript's minute passages for the
// passage-vector arm, each cached in the data dir. Ranking by claims is ClaimEmbeddingsRepository's
// own query on an in-memory Postgres holding the exported vectors, so it is search as it runs.

type Kind = "inOverview" | "transcriptOnly" | "twoMoments" | "notInSource" | "applyAcross" | "notInLibrary";

interface Question {
  id: string;
  kind: Kind;
  question: string;
  expected: string[];
  home: string | null;
  quotes: string[];
  mentions: string[];
}

interface Located extends Question {
  moments: Array<{ overviewId: string; startMs: number }>;
}

interface LibraryOverview {
  id: string;
  rev: number;
  schemaVersion: number;
  storedAt: string;
  overview: Overview;
  segments: TranscriptSegment[] | null;
}

interface Library {
  overviews: Map<string, LibraryOverview>;
  claimVectors: Map<string, number[][]>;
  raw: {
    overviews: Array<{ id: string; rev: number; schemaVersion: number; storedAt: string; body: unknown }>;
    embeddings: Array<{
      overviewId: string;
      embeddedRev: number;
      model: string;
      tokens: number;
      claims: Array<{ position: number; textHash: string; model: string; embedding: string }>;
    }>;
  };
}

const ACCOUNT = AccountId.parse("00000000-0000-4000-8000-000000000307");
const DEPTHS = [3, 5, 8] as const;
const TOLERANCE_MS = 10_000;

const normalised = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function locateQuote(segments: readonly TranscriptSegment[], quote: string): number | null {
  let joined = "";
  const starts: Array<{ offset: number; startMs: number }> = [];
  for (const segment of segments) {
    const text = normalised(segment.text);
    if (text.length === 0) continue;
    if (joined.length > 0) joined += " ";
    starts.push({ offset: joined.length, startMs: segment.startMs });
    joined += text;
  }
  const found = joined.indexOf(normalised(quote));
  if (found === -1) return null;
  return starts.filter((start) => start.offset <= found).at(-1)?.startMs ?? null;
}

const cosine = (left: readonly number[], right: readonly number[]) => {
  let dot = 0;
  let a = 0;
  let b = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i]! * right[i]!;
    a += left[i]! * left[i]!;
    b += right[i]! * right[i]!;
  }
  return dot / Math.sqrt(a * b);
};

async function loadLibrary(dataDir: string): Promise<Library> {
  const raw = JSON.parse(await readFile(join(dataDir, "library", "library.json"), "utf-8")) as Library["raw"];
  const overviews = new Map<string, LibraryOverview>();
  for (const row of raw.overviews) {
    const read = readStoredRecord(
      stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion),
      Overview,
      OVERVIEW_MIGRATIONS,
    );
    if (read.status !== "read") throw new Error(`overview ${row.id} did not read: ${read.status}`);
    const key = sourceKey(read.record.source);
    const text =
      key === null
        ? null
        : await readFile(join(dataDir, "library", "transcripts", `${encodeURIComponent(key)}.json`), "utf-8").catch(() => null);
    const transcript = text === null ? null : StoredTranscript.safeParse(JSON.parse(text));
    overviews.set(row.id, {
      id: row.id,
      rev: row.rev,
      schemaVersion: row.schemaVersion,
      storedAt: row.storedAt,
      overview: read.record,
      segments: transcript?.success === true && read.record.source.kind !== "web" ? transcript.data.segments : null,
    });
  }
  const claimVectors = new Map(
    raw.embeddings.map((row) => [row.overviewId, row.claims.map((claim) => JSON.parse(claim.embedding) as number[])]),
  );
  return { overviews, claimVectors, raw };
}

async function claimSearch(library: Library): Promise<(vector: number[]) => Promise<Array<{ overviewId: string; similarity: number }>>> {
  const sql = createPgliteSqlClient(createTestPglite());
  await runMigrations(sql, { before: migrationSteps() });
  await sql.query("insert into accounts (id, email) values ($1, 'reader@example.invalid')", [ACCOUNT]);
  let seq = 0;
  for (const row of library.raw.overviews) {
    seq += 1;
    await sql.query(
      `insert into records (account_id, kind, id, schema_version, rev, seq, updated_at, stored_at, deleted, body)
       values ($1, 'overview', $2, $3, $4, $5, $6, $7::timestamptz, false, $8::jsonb)`,
      [ACCOUNT, row.id, row.schemaVersion, row.rev, seq, new Date(row.storedAt).toISOString(), row.storedAt, JSON.stringify(row.body)],
    );
  }
  await sql.query("update accounts set last_seq = $2 where id = $1", [ACCOUNT, seq]);
  for (const row of library.raw.embeddings) {
    await sql.query(
      `insert into overview_embeddings (account_id, overview_id, embedded_rev, model, tokens, attempted_rev, attempts, updated_at)
       values ($1, $2, $3, $4, $5, $3, 0, now())`,
      [ACCOUNT, row.overviewId, row.embeddedRev, row.model, row.tokens],
    );
    for (const claim of row.claims) {
      await sql.query(
        `insert into claim_embeddings (account_id, overview_id, position, text_hash, model, embedding) values ($1, $2, $3, $4, $5, $6::vector)`,
        [ACCOUNT, row.overviewId, claim.position, claim.textHash, claim.model, claim.embedding],
      );
    }
  }
  const repository = new ClaimEmbeddingsRepository(sql);
  const model = library.raw.embeddings[0]!.model;
  return async (vector) =>
    (await repository.closest(ACCOUNT, vector, model, library.overviews.size)).filter((match) => match.similarity >= MEANING_FLOOR);
}

async function loadQuestions(dataDir: string, library: Library): Promise<{ located: Located[]; dropped: string[] }> {
  const questions: Question[] = [];
  for (const folder of ["ov267", "write"]) {
    for (const id of await readdir(join(dataDir, folder)).catch(() => [] as string[])) {
      const text = await readFile(join(dataDir, folder, id, "questions.json"), "utf-8").catch(() => null);
      if (text === null) continue;
      const set = JSON.parse(text) as { overviewId: string; questions: Array<Omit<Question, "expected" | "home">> };
      for (const question of set.questions) {
        questions.push({ ...question, id: `${set.overviewId.slice(0, 8)}.${question.id}`, expected: [set.overviewId], home: null });
      }
    }
  }
  const cross = JSON.parse(await readFile(join(dataDir, "cross.json"), "utf-8")) as { questions: Question[] };
  questions.push(...cross.questions.map((question) => ({ ...question, quotes: [] })));

  const located: Located[] = [];
  const dropped: string[] = [];
  for (const question of questions) {
    const source = library.overviews.get(question.expected[0] ?? "");
    const moments = question.quotes.map((quote) => {
      const startMs = source?.segments === null || source === undefined ? null : locateQuote(source.segments, quote);
      return startMs === null ? null : { overviewId: source!.id, startMs };
    });
    if (
      moments.some((moment) => moment === null) ||
      (question.expected.length > 0 && question.expected.some((id) => !library.overviews.has(id)))
    ) {
      dropped.push(question.id);
      continue;
    }
    located.push({ ...question, moments: moments as Located["moments"] });
  }
  return { located, dropped };
}

// The overview nearest the one that answers, by best pair of claims: where a reader plausibly is
// when they ask about the other.
function nearestHome(library: Library, overviewId: string): string {
  const own = library.claimVectors.get(overviewId) ?? [];
  let best = { id: "", similarity: -2 };
  for (const [id, vectors] of library.claimVectors) {
    if (id === overviewId) continue;
    for (const left of own) {
      for (const right of vectors) {
        const similarity = cosine(left, right);
        if (similarity > best.similarity) best = { id, similarity };
      }
    }
  }
  return best.id;
}

async function cachedEmbeddings(
  path: string,
  texts: string[],
  apiKey: string,
): Promise<{ vectors: Map<string, number[]>; tokens: number }> {
  const cached = new Map<string, number[]>(
    Object.entries(JSON.parse((await readFile(path, "utf-8").catch(() => "{}")) as string) as Record<string, number[]>),
  );
  const missing = [...new Set(texts)].filter((text) => !cached.has(text));
  let tokens = 0;
  if (missing.length > 0) {
    const embedded = await createOpenAiEmbedder({ apiKey, http: fetch }).embed(missing);
    tokens = embedded.tokens;
    missing.forEach((text, index) => cached.set(text, embedded.vectors[index]!));
    await writeFile(path, JSON.stringify(Object.fromEntries(cached)));
  }
  return { vectors: cached, tokens };
}

interface RetrievalRow {
  id: string;
  kind: Kind;
  home: string;
  expected: string[];
  claimRank: number | null;
  passageRank: number | null;
  unionRank: Record<string, boolean>;
  claimOrder: string[];
  claimTopSimilarity: number | null;
  expectedSimilarity: number | null;
}

async function retrieval(dataDir: string, outPath: string): Promise<void> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY is needed for the question and passage embeddings");
  const library = await loadLibrary(dataDir);
  const { located, dropped } = await loadQuestions(dataDir, library);
  console.error(`${library.overviews.size} overviews, ${located.length} questions located, dropped: ${dropped.join(", ") || "none"}`);
  await mkdir(join(dataDir, "embeddings"), { recursive: true });

  const queries = located.map((question) => question.question.trim().toLowerCase());
  const questionVectors = await cachedEmbeddings(join(dataDir, "embeddings", "questions.json"), queries, apiKey);

  const passagesOf = new Map<string, Passage[]>();
  for (const entry of library.overviews.values()) if (entry.segments !== null) passagesOf.set(entry.id, transcriptPassages(entry.segments));
  const passageTexts = [...passagesOf.values()].flat().map((passage) => passage.text);
  const passageVectors = await cachedEmbeddings(join(dataDir, "embeddings", "passages.json"), passageTexts, apiKey);
  const hours = [...library.overviews.values()].reduce((total, entry) => total + (entry.segments?.at(-1)?.endMs ?? 0), 0) / 3_600_000;

  const search = await claimSearch(library);
  const rows: RetrievalRow[] = [];
  for (const [index, question] of located.entries()) {
    const home = question.home ?? nearestHome(library, question.expected[0]!);
    const vector = questionVectors.vectors.get(queries[index]!)!;
    const byClaims = (await search(vector)).filter((match) => match.overviewId !== home);
    const byPassages = [...passagesOf.entries()]
      .filter(([id]) => id !== home)
      .map(([id, passages]) => ({
        id,
        similarity: Math.max(...passages.map((passage) => cosine(vector, passageVectors.vectors.get(passage.text)!))),
      }))
      .sort((left, right) => right.similarity - left.similarity);
    const rankIn = (order: string[]) => {
      const ranks = question.expected.map((id) => order.indexOf(id)).filter((rank) => rank >= 0);
      return ranks.length === 0 ? null : Math.min(...ranks) + 1;
    };
    const claimOrder = byClaims.map((match) => match.overviewId);
    const passageOrder = byPassages.map((match) => match.id);
    rows.push({
      id: question.id,
      kind: question.kind,
      home,
      expected: question.expected,
      claimRank: rankIn(claimOrder),
      passageRank: rankIn(passageOrder),
      unionRank: Object.fromEntries(
        DEPTHS.map((depth) => [
          String(depth),
          question.expected.some((id) => claimOrder.slice(0, depth).includes(id) || passageOrder.slice(0, depth).includes(id)),
        ]),
      ),
      claimOrder: claimOrder.slice(0, 20),
      claimTopSimilarity: byClaims[0]?.similarity ?? null,
      expectedSimilarity: byClaims.find((match) => question.expected.includes(match.overviewId))?.similarity ?? null,
    });
  }
  const price = 0.02 / 1_000_000;
  const report = {
    ranAt: new Date().toISOString(),
    library: {
      overviews: library.overviews.size,
      withTranscript: passagesOf.size,
      transcriptHours: Math.round(hours * 10) / 10,
      passages: passageTexts.length,
    },
    spent: {
      questionTokens: questionVectors.tokens,
      passageTokens: passageVectors.tokens,
      dollars: (questionVectors.tokens + passageVectors.tokens) * price,
    },
    dropped,
    rows,
  };
  await writeFile(outPath, `${JSON.stringify(report, null, 1)}\n`);
  console.log(retrievalMarkdown(report.rows));
  console.error(
    `spent ${report.spent.dollars.toFixed(4)} on embeddings this run; ${report.library.transcriptHours} h of transcript in ${report.library.passages} passages`,
  );
}

function retrievalMarkdown(rows: RetrievalRow[]): string {
  const kinds = [...new Set(rows.map((row) => row.kind))];
  const hit = (rank: number | null, depth: number) => rank !== null && rank <= depth;
  const line = (label: string, subset: RetrievalRow[]) =>
    `| ${label} | ${subset.length} | ${DEPTHS.map((depth) => `${subset.filter((row) => hit(row.claimRank, depth)).length}`).join(" | ")} | ${DEPTHS.map((depth) => `${subset.filter((row) => hit(row.passageRank, depth)).length}`).join(" | ")} | ${DEPTHS.map((depth) => `${subset.filter((row) => row.unionRank[String(depth)]).length}`).join(" | ")} |`;
  return [
    "| Kind | Questions | Claims top 3 | top 5 | top 8 | Passages top 3 | top 5 | top 8 | Either top 3 | top 5 | top 8 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...kinds
      .filter((kind) => kind !== "notInLibrary")
      .map((kind) =>
        line(
          kind,
          rows.filter((row) => row.kind === kind),
        ),
      ),
    line(
      "all answerable",
      rows.filter((row) => row.kind !== "notInLibrary" && row.kind !== "notInSource"),
    ),
  ].join("\n");
}

// --- answering ---

type Arm = { name: string; pick: (row: RetrievalRow) => string[]; transcripts: boolean | "closest" };

function arms(): Map<string, Arm> {
  const pinned = (count: number) => (row: RetrievalRow) => {
    const pins = row.expected.slice(0, Math.min(row.expected.length, count));
    for (const id of row.claimOrder) {
      if (pins.length >= count) break;
      if (!pins.includes(id)) pins.push(id);
    }
    return pins;
  };
  const search = (count: number) => (row: RetrievalRow) => row.claimOrder.slice(0, count);
  const list: Arm[] = [
    { name: "home", pick: () => [], transcripts: false },
    { name: "search3-full", pick: search(3), transcripts: true },
    { name: "search3-overviews", pick: search(3), transcripts: false },
    { name: "search5-overviews", pick: search(5), transcripts: false },
    { name: "pinned1-overviews", pick: pinned(1), transcripts: false },
    { name: "pinned3-overviews", pick: pinned(3), transcripts: false },
    { name: "pinned8-overviews", pick: pinned(8), transcripts: false },
    { name: "pinned3-full", pick: pinned(3), transcripts: true },
    { name: "search3+passages8", pick: search(3), transcripts: "closest" },
    {
      name: "pinned1+search3-overviews",
      pick: (row) => [...new Set([...row.expected.slice(0, 1), ...search(3)(row)])],
      transcripts: false,
    },
  ];
  return new Map(list.map((arm) => [arm.name, arm]));
}

interface OtherSource {
  label: string;
  overviewId: string;
  title: string;
  passages: Passage[];
  partIds: string[];
}

const PART_ID = /\[((?:verdict|sells|anyway)|(?:dubious|kp|step|apply|ing|method|ch)\d+)\] /g;

function otherSourcesBlock(
  library: Library,
  ids: string[],
  wanted: boolean | ReadonlyMap<string, Passage[]>,
): { text: string; sources: OtherSource[] } {
  const transcripts = wanted !== false;
  const sources: OtherSource[] = [];
  const blocks = ids.map((id, index) => {
    const entry = library.overviews.get(id)!;
    const label = `S${index + 1}`;
    const markdown = overviewMarkdown(entry.overview, { partIds: true }).replace(PART_ID, (_, part: string) => `[${label}.${part}] `);
    const passages =
      typeof wanted === "object" ? (wanted.get(id) ?? []) : wanted && entry.segments !== null ? transcriptPassages(entry.segments) : [];
    sources.push({
      label,
      overviewId: id,
      title: entry.overview.source.title ?? id,
      passages,
      partIds: overviewParts(entry.overview).map(({ part, index: at }) => `${label}.${overviewPartId(part, at)}`),
    });
    const transcript =
      passages.length === 0
        ? ""
        : `\n\n### ${typeof wanted === "object" ? "Passages of the transcript closest to the question, from" : "Transcript of"} ${label}\n\n${passages.map((passage) => `[${label}.${passage.id} ${formatClock(passage.startMs / 1000)}] ${passage.text}`).join("\n")}`;
    return `## ${label}\n\n${markdown}${transcript}`;
  });
  const text = `# Other overviews from the reader's library

The reader saved these too. They are not what this chat is about, but the reader may ask about them or how they apply here. Each is labelled S1, S2 and so on, and its ids carry the label (such as S2.kp3${transcripts ? " or S2.p14" : ""}).
- When an answer uses one, name it by its title in the answer, and list its ids in overviewParts${transcripts ? " (items) or passages (its transcript)" : ""}. ${transcripts ? "Their passage ids go in passages even where this chat's own material has no transcript. " : "There are no transcripts for these: cite their items only. "}
- When two of them disagree, or one disagrees with this ${"source"}, say so plainly rather than blending them.
- When none of them answers a question about the reader's other saved overviews, say none of the overviews you were shown cover it, and cite none of them. Never say the reader's library has nothing on it: you are only shown a few.
- inSource is still about this chat's own transcript alone.

${blocks.join("\n\n")}`;
  return { text, sources };
}

interface AnswerTurn {
  arm: string;
  run: number;
  id: string;
  kind: Kind;
  others: string[];
  pickedExpected: boolean;
  failed: boolean;
  citedExpected: boolean | null;
  citedRightMoment: boolean | null;
  mentioned: boolean | null;
  citedAnyOther: boolean;
  citedOthers: string[];
  homeCitations: number;
  generalKnowledge: boolean | null;
  answer: string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  costDollars: number;
  followUpDollars: number;
  ms: number;
}

async function answer(
  dataDir: string,
  retrievalPath: string,
  outPath: string,
  options: { arms: string[]; runs: number; budget: number; dryRun: boolean; only: string | null },
) {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!options.dryRun && !apiKey) throw new Error("OPENAI_API_KEY is needed");
  const library = await loadLibrary(dataDir);
  const { located } = await loadQuestions(dataDir, library);
  const retrievalRows = (JSON.parse(await readFile(retrievalPath, "utf-8")) as { rows: RetrievalRow[] }).rows;
  const byId = new Map(located.map((question) => [question.id, question]));
  const all = arms();
  const vectorCache = async (file: string) =>
    new Map(Object.entries(JSON.parse(await readFile(join(dataDir, "embeddings", file), "utf-8")) as Record<string, number[]>));
  const closestNeeded = options.arms.some((name) => all.get(name)?.transcripts === "closest");
  const questionVectors = closestNeeded ? await vectorCache("questions.json") : new Map<string, number[]>();
  const passageVectors = closestNeeded ? await vectorCache("passages.json") : new Map<string, number[]>();
  // The passage-vector shape: the eight minutes of transcript closest to the question anywhere
  // in the library but this chat's own source, each going in with its overview.
  const closestPassages = (question: Located, home: string): Map<string, Passage[]> => {
    const vector = questionVectors.get(question.question.trim().toLowerCase())!;
    const scored = [...library.overviews.values()]
      .filter((entry) => entry.id !== home && entry.segments !== null)
      .flatMap((entry) =>
        transcriptPassages(entry.segments!).map((passage) => ({
          id: entry.id,
          passage,
          similarity: cosine(vector, passageVectors.get(passage.text)!),
        })),
      )
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 8);
    const chosen = new Map<string, Passage[]>();
    for (const { id, passage } of scored)
      chosen.set(
        id,
        [...(chosen.get(id) ?? []), passage].sort((a, b) => a.startMs - b.startMs),
      );
    return chosen;
  };
  const price = priceOf(chatModel)!;
  const done: AnswerTurn[] = JSON.parse((await readFile(outPath, "utf-8").catch(() => "[]")) as string) as AnswerTurn[];
  const key = (arm: string, run: number, id: string) => `${arm}|${run}|${id}`;
  const seen = new Set(done.map((turn) => key(turn.arm, turn.run, turn.id)));
  let spent = done.reduce((total, turn) => total + turn.costDollars, 0);
  let ceiling = 0;

  for (const armName of options.arms) {
    if (armName.startsWith("map-")) {
      spent = await mapArm(dataDir, library, outPath.replace(/\.json$/, ".map.json"), armName, { ...options, spent, apiKey: apiKey ?? "" });
      continue;
    }
    const arm = all.get(armName);
    if (arm === undefined) throw new Error(`no arm ${armName}: ${[...all.keys()].join(", ")}`);
    for (let run = 1; run <= options.runs; run += 1) {
      for (const row of retrievalRows) {
        const question = byId.get(row.id);
        if (question === undefined) continue;
        if (options.only !== null && !new RegExp(options.only).test(question.kind)) continue;
        if (seen.has(key(arm.name, run, row.id))) continue;
        const home = library.overviews.get(row.home)!;
        const kind = chatSourceKind(home.overview);
        const homePassages = home.segments === null ? [] : transcriptPassages(home.segments);
        const closest = arm.transcripts === "closest" ? closestPassages(question, row.home) : null;
        const others = [...new Set([...arm.pick(row), ...(closest?.keys() ?? [])])].filter((id) => id !== row.home);
        const system = chatSystemPrompt(kind, overviewMarkdown(home.overview, { partIds: true }), homePassages, {
          recipe: home.overview.recipe !== null,
        });
        const block = others.length === 0 ? null : otherSourcesBlock(library, others, closest ?? arm.transcripts === true);
        const messages: PromptMessage[] = [
          { role: "system", content: system },
          ...(block === null ? [] : [{ role: "user" as const, content: block.text }]),
          { role: "user", content: question.question },
        ];
        const characters = messages.reduce((total, message) => total + message.content.length, 0);
        if (options.dryRun && process.env["SHOW"] === row.id) {
          console.log(messages.map((message) => `=== ${message.role}\n${message.content}`).join("\n\n"));
        }
        if (options.dryRun) {
          ceiling += (characters / 4) * (price.perMillion.input / 1_000_000) + (300 * price.perMillion.output) / 1_000_000;
          continue;
        }
        if (spent >= options.budget) {
          console.error(`budget of $${options.budget} reached at $${spent.toFixed(4)}`);
          await writeFile(outPath, `${JSON.stringify(done, null, 1)}\n`);
          return;
        }
        const startedAt = Date.now();
        let turn: AnswerTurn;
        try {
          const stream = await streamChatCompletion(
            { apiKey: apiKey!, http: fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), retried: () => {} },
            messages,
            `ov307-${arm.name}-${run}-${row.id}`,
          );
          let raw = "";
          for await (const piece of stream.pieces) raw += piece;
          const reply = ChatReply.parse(JSON.parse(raw));
          const usage = stream.usage();
          turn = score(
            arm.name,
            run,
            question,
            row,
            others,
            block?.sources ?? [],
            homePassages,
            reply,
            usage,
            price,
            Date.now() - startedAt,
          );
        } catch (error) {
          turn = {
            arm: arm.name,
            run,
            id: row.id,
            kind: question.kind,
            others,
            pickedExpected: question.expected.some((id) => others.includes(id)),
            failed: true,
            citedExpected: null,
            citedRightMoment: null,
            mentioned: null,
            citedAnyOther: false,
            citedOthers: [],
            homeCitations: 0,
            generalKnowledge: null,
            answer: error instanceof Error ? error.message : String(error),
            inputTokens: 0,
            cachedTokens: 0,
            outputTokens: 0,
            costDollars: 0,
            followUpDollars: 0,
            ms: Date.now() - startedAt,
          };
        }
        done.push(turn);
        spent += turn.costDollars;
        if (done.length % 10 === 0) await writeFile(outPath, `${JSON.stringify(done, null, 1)}\n`);
        console.error(
          `${arm.name} r${run} ${row.id} ${turn.failed ? "FAILED" : `$${turn.costDollars.toFixed(5)} cited ${turn.citedOthers.join(",") || "-"}`}`,
        );
      }
    }
  }
  if (options.dryRun) {
    console.log(`dry run: ceiling about $${ceiling.toFixed(2)} (characters / 4 at the uncached input price, 300 output tokens each)`);
    return;
  }
  await writeFile(outPath, `${JSON.stringify(done, null, 1)}\n`);
  console.log(answerMarkdown(done));
  console.error(`spent $${spent.toFixed(4)} in all`);
}

function score(
  arm: string,
  run: number,
  question: Located,
  row: RetrievalRow,
  others: string[],
  sources: OtherSource[],
  homePassages: Passage[],
  reply: ChatReply,
  usage: TokenUsage | null,
  price: NonNullable<ReturnType<typeof priceOf>>,
  ms: number,
): AnswerTurn {
  const cited = new Set([...reply.passages, ...reply.overviewParts]);
  const citedSources = sources.filter((source) =>
    [...cited].some(
      (id) =>
        (id.startsWith(`${source.label}.`) && source.partIds.includes(id)) ||
        source.passages.some((passage) => `${source.label}.${passage.id}` === id),
    ),
  );
  const citedOthers = citedSources.map((source) => source.overviewId);
  const expectedCited = question.expected.some((id) => citedOthers.includes(id));
  const momentCited =
    question.moments.length === 0
      ? null
      : question.moments.every((moment) => {
          const source = sources.find((candidate) => candidate.overviewId === moment.overviewId);
          if (source === undefined) return false;
          return source.passages.some(
            (passage) =>
              cited.has(`${source.label}.${passage.id}`) &&
              moment.startMs >= passage.startMs - TOLERANCE_MS &&
              moment.startMs <= passage.endMs + TOLERANCE_MS,
          );
        });
  const text = withoutCitationMarks(reply.answer);
  const lower = text.toLowerCase();
  const answerable = question.kind !== "notInLibrary" && question.kind !== "notInSource";
  const inputTokens = usage === null ? 0 : promptTokensOf(usage);
  const costDollars = usage === null ? 0 : costInDollars(price, usage);
  const followUp: TokenUsage | null =
    usage === null
      ? null
      : { uncachedInputTokens: 0, cacheWriteTokens: 0, cachedInputTokens: inputTokens, outputTokens: usage.outputTokens };
  return {
    arm,
    run,
    id: question.id,
    kind: question.kind,
    others,
    pickedExpected: question.expected.some((id) => others.includes(id)),
    failed: false,
    citedExpected: answerable ? expectedCited : null,
    citedRightMoment: answerable ? momentCited : null,
    mentioned: question.mentions.length === 0 ? null : question.mentions.some((term) => lower.includes(term.toLowerCase())),
    citedAnyOther: citedOthers.length > 0,
    citedOthers,
    homeCitations: reply.passages.filter((id) => homePassages.some((passage) => passage.id === id)).length,
    generalKnowledge: reply.generalKnowledge,
    answer: text,
    inputTokens,
    cachedTokens: usage?.cachedInputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    costDollars,
    followUpDollars: followUp === null ? 0 : costInDollars(price, followUp),
    ms,
  };
}

// --- an empty chat over the whole library ---

interface SynthesisQuestion {
  id: string;
  question: string;
  core: string[];
  relevant: string[];
  recipesRelevant: boolean;
}

interface MapTurn {
  arm: string;
  run: number;
  id: string;
  failed: boolean;
  cited: string[];
  invalidIds: string[];
  topicsCited: number;
  precision: number | null;
  coreFound: number | null;
  coreTotal: number;
  answer: string;
  inputTokens: number;
  outputTokens: number;
  costDollars: number;
  followUpDollars: number;
  ms: number;
}

// Every overview the reader saved, compact enough to send whole: the material for a question no
// one overview answers ("what do my saved overviews have in common?").
function libraryMap(library: Library, withKeyPoints: boolean): { text: string; labels: Map<string, string>; partIds: Set<string> } {
  const labels = new Map<string, string>();
  const partIds = new Set<string>();
  const blocks = [...library.overviews.values()].map((entry, index) => {
    const label = `O${index + 1}`;
    labels.set(label, entry.id);
    const { overview } = entry;
    const points = withKeyPoints
      ? overview.keyPoints.map((point, at) => {
          partIds.add(`${label}.kp${at + 1}`);
          return `- [${label}.kp${at + 1}] ${point.text}`;
        })
      : [];
    return [`## [${label}] ${overview.source.title ?? ""}`, overview.bigPicture ?? "", overview.coreClaim, ...points]
      .filter((line) => line !== "")
      .join("\n");
  });
  const text = `You answer a reader's questions about their whole library in The Overview: every overview they have saved, listed below. Each has an id (O1, O2 and so on) and shows its title, its big picture and its core claim${withKeyPoints ? ", then its key points, each with its own id (such as O12.kp3)" : ""}.

Answer from the library below. Answer in up to eight short sentences, or a short list when the question asks for several things.
- Name each overview you draw on by its title, and list in overviewParts the ids the answer rests on (${withKeyPoints ? "an overview's id, or a key point's id" : "overview ids such as O12"}).
- Never give a count of overviews, or a share of the library: say "several" or "most" instead.
- When the library doesn't cover what the question asks, say so plainly, and never invent an overview.
- When overviews disagree, say which ones, and how.
- There is no transcript here: always set inSource to false, leave passages and chatMessages empty, and set generalKnowledge to false unless you add something from beyond the library, which you mark as such.

# The library

${blocks.join("\n\n")}`;
  return { text, labels, partIds };
}

async function mapArm(
  dataDir: string,
  library: Library,
  outPath: string,
  armName: string,
  options: { runs: number; budget: number; dryRun: boolean; spent: number; apiKey: string },
): Promise<number> {
  const withKeyPoints = armName === "map-keypoints";
  if (!withKeyPoints && armName !== "map-compact") throw new Error(`no arm ${armName}`);
  const questions = (JSON.parse(await readFile(join(dataDir, "synthesis.json"), "utf-8")) as { questions: SynthesisQuestion[] }).questions;
  const resolve = (prefix: string) => [...library.overviews.keys()].find((id) => id.startsWith(prefix)) ?? prefix;
  const map = libraryMap(library, withKeyPoints);
  const price = priceOf(chatModel)!;
  const done: MapTurn[] = JSON.parse((await readFile(outPath, "utf-8").catch(() => "[]")) as string) as MapTurn[];
  let spent = options.spent;
  if (options.dryRun) {
    const each = (map.text.length / 4) * (price.perMillion.input / 1_000_000) + (600 * price.perMillion.output) / 1_000_000;
    console.log(
      `${armName}: about ${Math.round(map.text.length / 4)} prompt tokens; dry run ceiling about $${(each * questions.length * options.runs).toFixed(3)}`,
    );
    return spent;
  }
  for (let run = 1; run <= options.runs; run += 1) {
    for (const question of questions) {
      if (done.some((turn) => turn.arm === armName && turn.run === run && turn.id === question.id)) continue;
      if (spent >= options.budget) {
        console.error(`budget of $${options.budget} reached at $${spent.toFixed(4)}`);
        break;
      }
      const core = question.core.map(resolve);
      const relevant = new Set([...core, ...question.relevant.map(resolve)]);
      if (question.recipesRelevant)
        for (const entry of library.overviews.values()) if (entry.overview.recipe !== null) relevant.add(entry.id);
      const startedAt = Date.now();
      let turn: MapTurn;
      try {
        const stream = await streamChatCompletion(
          { apiKey: options.apiKey, http: fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), retried: () => {} },
          [
            { role: "system", content: map.text },
            { role: "user", content: question.question },
          ],
          `ov307-${armName}`,
        );
        let raw = "";
        for await (const piece of stream.pieces) raw += piece;
        const reply = ChatReply.parse(JSON.parse(raw));
        const usage = stream.usage();
        const ids = [...new Set(reply.overviewParts)];
        const invalidIds = ids.filter((id) => !map.labels.has(id) && !map.partIds.has(id));
        const cited = [...new Set(ids.flatMap((id) => map.labels.get(id.split(".")[0]!) ?? []))];
        const topics = new Set(cited.flatMap((id) => library.overviews.get(id)?.overview.topicIds ?? []));
        const inputTokens = usage === null ? 0 : promptTokensOf(usage);
        turn = {
          arm: armName,
          run,
          id: question.id,
          failed: false,
          cited,
          invalidIds,
          topicsCited: topics.size,
          precision: relevant.size === 0 || cited.length === 0 ? null : cited.filter((id) => relevant.has(id)).length / cited.length,
          coreFound: core.length === 0 ? null : core.filter((id) => cited.includes(id)).length,
          coreTotal: core.length,
          answer: withoutCitationMarks(reply.answer),
          inputTokens,
          outputTokens: usage?.outputTokens ?? 0,
          costDollars: usage === null ? 0 : costInDollars(price, usage),
          followUpDollars:
            usage === null
              ? 0
              : costInDollars(price, {
                  uncachedInputTokens: 0,
                  cacheWriteTokens: 0,
                  cachedInputTokens: inputTokens,
                  outputTokens: usage.outputTokens,
                }),
          ms: Date.now() - startedAt,
        };
      } catch (error) {
        turn = {
          arm: armName,
          run,
          id: question.id,
          failed: true,
          cited: [],
          invalidIds: [],
          topicsCited: 0,
          precision: null,
          coreFound: null,
          coreTotal: 0,
          answer: error instanceof Error ? error.message : String(error),
          inputTokens: 0,
          outputTokens: 0,
          costDollars: 0,
          followUpDollars: 0,
          ms: Date.now() - startedAt,
        };
      }
      done.push(turn);
      spent += turn.costDollars;
      await writeFile(outPath, `${JSON.stringify(done, null, 1)}\n`);
      console.error(
        `${armName} r${run} ${question.id} ${turn.failed ? "FAILED" : `$${turn.costDollars.toFixed(5)} cited ${turn.cited.length}`}`,
      );
    }
  }
  console.log(mapMarkdown(done));
  return spent;
}

function mapMarkdown(turns: MapTurn[]): string {
  return [
    "| Arm | Question | Run | Overviews cited | Topics among them | Ids not in the library | On the subject | Core overviews found | Prompt tokens | First message | Cached follow-up |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...turns.map(
      (turn) =>
        `| ${turn.arm} | ${turn.id} | ${turn.run} | ${turn.failed ? "FAILED" : turn.cited.length} | ${turn.topicsCited} | ${turn.invalidIds.length} | ${turn.precision === null ? "—" : `${Math.round(turn.precision * 100)}%`} | ${turn.coreFound === null ? "—" : `${turn.coreFound}/${turn.coreTotal}`} | ${turn.inputTokens} | $${turn.costDollars.toFixed(5)} | $${turn.followUpDollars.toFixed(5)} |`,
    ),
  ].join("\n");
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]!;
};

function answerMarkdown(turns: AnswerTurn[]): string {
  const armNames = [...new Set(turns.map((turn) => turn.arm))];
  const count = (subset: AnswerTurn[], test: (turn: AnswerTurn) => boolean | null) => {
    const scored = subset.filter((turn) => test(turn) !== null);
    return `${scored.filter((turn) => test(turn) === true).length}/${scored.length}`;
  };
  const rows = armNames.map((name) => {
    const subset = turns.filter((turn) => turn.arm === name && !turn.failed);
    const answerable = subset.filter((turn) => turn.citedExpected !== null);
    const declineSet = subset.filter((turn) => turn.kind === "notInLibrary");
    return `| ${name} | ${turns.filter((turn) => turn.arm === name && turn.failed).length} | ${median(subset.map((turn) => turn.inputTokens))} | $${median(subset.map((turn) => turn.costDollars)).toFixed(5)} | $${median(subset.map((turn) => turn.followUpDollars)).toFixed(5)} | ${count(answerable, (turn) => turn.pickedExpected)} | ${count(answerable, (turn) => turn.citedExpected)} | ${count(
      answerable.filter((turn) => turn.pickedExpected),
      (turn) => turn.citedExpected,
    )} | ${count(subset, (turn) => turn.citedRightMoment)} | ${count(subset, (turn) => turn.mentioned)} | ${count(
      subset.filter((turn) => turn.kind === "applyAcross"),
      (turn) => turn.citedExpected,
    )} | ${count(declineSet, (turn) => !turn.citedAnyOther)} | ${(median(subset.map((turn) => turn.ms)) / 1000).toFixed(1)} s |`;
  });
  return [
    "| Arm | Failed | Prompt tokens (median) | First message (median) | Cached follow-up (median) | Source given | Cited the source | Cited it when given | Cited the right moment | Named the detail | applyAcross cited | notInLibrary cited none | Latency |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    arms: { type: "string", default: "home" },
    runs: { type: "string", default: "2" },
    budget: { type: "string", default: "1" },
    only: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    report: { type: "boolean", default: false },
  },
});
const [command, dataDir, ...rest] = positionals;
if (command === "retrieval" && dataDir && rest[0]) {
  await retrieval(dataDir, rest[0]);
} else if (command === "answer" && dataDir && rest[0] && rest[1]) {
  if (values.report) {
    console.log(answerMarkdown(JSON.parse(await readFile(rest[1], "utf-8")) as AnswerTurn[]));
  } else {
    await answer(dataDir, rest[0], rest[1], {
      arms: values.arms.split(","),
      runs: Number(values.runs),
      budget: Number(values.budget),
      dryRun: values["dry-run"],
      only: values.only ?? null,
    });
  }
} else {
  console.error(
    "usage: chatAcrossSourcesCheck retrieval <data dir> <out.json> | answer <data dir> <retrieval.json> <out.json> --arms a,b [--runs 2] [--budget 1] [--dry-run] [--report]",
  );
  process.exit(1);
}
