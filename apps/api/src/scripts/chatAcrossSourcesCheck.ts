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
  isInProject,
  Project,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  ProjectMember,
  VideoId,
  type OverviewId,
  type TranscriptSegment,
} from "@overview/domain";
import { costInDollars, priceOf, promptTokensOf, tokenUsageOf, type TokenUsage } from "@overview/generation";
import { makeStoredTranscript } from "@overview/store-conformance";
import { AccountId } from "../auth/AccountId.js";
import { allIds, CHAT_REPLY_SCHEMA, ChatReply, citedIds, type CitedIds } from "../chats/ChatReply.js";
import { chatModel } from "../chats/chatModel.js";
import { chatSystemPrompt } from "../chats/chatPrompt.js";
import { libraryChatMaterial, PICK_SHAPE, pickedBlock, pickPrompt, SECTIONED_SHAPE } from "../chats/libraryChatPrompt.js";
import { otherSourcesInPrompt } from "../chats/otherSourcesInPrompt.js";
import { streamChatCompletion, type PromptMessage } from "../chats/streamChatCompletion.js";
import { transcriptPassages, type Passage } from "../chats/transcriptPassages.js";
import { withoutCitationMarks } from "../chats/withoutCitationMarks.js";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { ClaimEmbeddingsRepository } from "../meaning/ClaimEmbeddingsRepository.js";
import { TranscriptPassagesRepository } from "../transcripts/TranscriptPassagesRepository.js";
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
//   node dist/scripts/chatAcrossSourcesCheck.js twopass <data dir> <out.json> --arms structured-map,two-pass,shipped --runs 1 --budget 1 [--dry-run]
//   node dist/scripts/chatAcrossSourcesCheck.js project <data dir> <out.json> --arms a,b --runs 2 --budget 1 [--dry-run]
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

interface LibraryProject {
  project: Project;
  members: string[];
}

interface Library {
  overviews: Map<string, LibraryOverview>;
  claimVectors: Map<string, number[][]>;
  projects: Map<string, LibraryProject>;
  raw: {
    projects?: Array<{ id: string; schemaVersion: number; body: unknown }>;
    projectMembers?: Array<{ id: string; schemaVersion: number; body: unknown }>;
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

const locateQuote = (segments: readonly TranscriptSegment[], quote: string): number | null => {
  let joined = "";
  const starts: Array<{ offset: number; startMs: number }> = [];
  for (const segment of segments) {
    const text = normalised(segment.text);
    if (text.length === 0) {
      continue;
    }
    if (joined.length > 0) {
      joined += " ";
    }
    starts.push({ offset: joined.length, startMs: segment.startMs });
    joined += text;
  }
  const found = joined.indexOf(normalised(quote));
  if (found === -1) {
    return null;
  }
  return starts.filter((start) => start.offset <= found).at(-1)?.startMs ?? null;
};

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

const loadLibrary = async (dataDir: string): Promise<Library> => {
  const raw = JSON.parse(await readFile(join(dataDir, "library", "library.json"), "utf-8")) as Library["raw"];
  const overviews = new Map<string, LibraryOverview>();
  for (const row of raw.overviews) {
    const read = readStoredRecord(
      stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion),
      Overview,
      OVERVIEW_MIGRATIONS,
    );
    if (read.status !== "read") {
      throw new Error(`overview ${row.id} did not read: ${read.status}`);
    }
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
  const members = (raw.projectMembers ?? []).flatMap((row) => {
    const read = readStoredRecord(
      stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion),
      ProjectMember,
      PROJECT_MEMBER_MIGRATIONS,
    );
    return read.status === "read" && isInProject(read.record) && overviews.has(read.record.overviewId) ? [read.record] : [];
  });
  const projects = new Map<string, LibraryProject>();
  for (const row of raw.projects ?? []) {
    const read = readStoredRecord(stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion), Project, PROJECT_MIGRATIONS);
    if (read.status !== "read" || read.record.archivedAt !== null) {
      continue;
    }
    projects.set(read.record.id, {
      project: read.record,
      members: members
        .filter((member) => member.projectId === read.record.id)
        .sort((left, right) => left.addedAt.localeCompare(right.addedAt))
        .map((member) => member.overviewId),
    });
  }
  return { overviews, claimVectors, projects, raw };
};

const claimSearch = async (library: Library): Promise<(vector: number[]) => Promise<Array<{ overviewId: string; similarity: number }>>> => {
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
};

const loadQuestions = async (dataDir: string, library: Library): Promise<{ located: Located[]; dropped: string[] }> => {
  const questions: Question[] = [];
  for (const folder of ["ov267", "write"]) {
    for (const id of await readdir(join(dataDir, folder)).catch(() => [] as string[])) {
      const text = await readFile(join(dataDir, folder, id, "questions.json"), "utf-8").catch(() => null);
      if (text === null) {
        continue;
      }
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
};

// The overview nearest the one that answers, by best pair of claims: where a reader plausibly is
// when they ask about the other.
const nearestHome = (library: Library, overviewId: string): string => {
  const own = library.claimVectors.get(overviewId) ?? [];
  let best = { id: "", similarity: -2 };
  for (const [id, vectors] of library.claimVectors) {
    if (id === overviewId) {
      continue;
    }
    for (const left of own) {
      for (const right of vectors) {
        const similarity = cosine(left, right);
        if (similarity > best.similarity) {
          best = { id, similarity };
        }
      }
    }
  }
  return best.id;
};

const cachedEmbeddings = async (
  path: string,
  texts: string[],
  apiKey: string,
): Promise<{ vectors: Map<string, number[]>; tokens: number }> => {
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
};

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

const retrieval = async (dataDir: string, outPath: string): Promise<void> => {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is needed for the question and passage embeddings");
  }
  const library = await loadLibrary(dataDir);
  const { located, dropped } = await loadQuestions(dataDir, library);
  console.error(`${library.overviews.size} overviews, ${located.length} questions located, dropped: ${dropped.join(", ") || "none"}`);
  await mkdir(join(dataDir, "embeddings"), { recursive: true });

  const queries = located.map((question) => question.question.trim().toLowerCase());
  const questionVectors = await cachedEmbeddings(join(dataDir, "embeddings", "questions.json"), queries, apiKey);

  const passagesOf = new Map<string, Passage[]>();
  for (const entry of library.overviews.values()) {
    if (entry.segments !== null) {
      passagesOf.set(entry.id, transcriptPassages(entry.segments));
    }
  }
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
};

const retrievalMarkdown = (rows: RetrievalRow[]): string => {
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
};

// --- keyword search over the kept transcripts ---

// The card's open question: before any vectors, would words find what claim search misses? BM25
// over the same minute passages, a source scoring as its best passage. Nothing is stored or paid
// for; Postgres full-text search would be the built version.
const STOPWORDS = new Set(
  "a an and are as at be been but by can could did do does doing for from had has have he her his how i if in into is it its just me my of on or our out she so than that the their them then there these they this to up was we were what when where which who why will with would you your about after all also any because before being both did does each few more most much no not now only other over own same should some such too under until very via what whom yours say says said tell told saved video videos overview overviews episode".split(
    " ",
  ),
);

const termsOf = (text: string): string[] =>
  normalised(text)
    .split(" ")
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map((word) => (word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word));

const keywordIndex = (library: Library) => {
  const docs: Array<{ overviewId: string; passage: Passage; terms: Map<string, number>; length: number }> = [];
  for (const entry of library.overviews.values()) {
    if (entry.segments === null) {
      continue;
    }
    for (const passage of transcriptPassages(entry.segments)) {
      const terms = new Map<string, number>();
      const words = termsOf(passage.text);
      for (const word of words) {
        terms.set(word, (terms.get(word) ?? 0) + 1);
      }
      docs.push({ overviewId: entry.id, passage, terms, length: words.length });
    }
  }
  const frequency = new Map<string, number>();
  for (const doc of docs) {
    for (const term of doc.terms.keys()) {
      frequency.set(term, (frequency.get(term) ?? 0) + 1);
    }
  }
  const average = docs.reduce((total, doc) => total + doc.length, 0) / docs.length;
  const K1 = 1.2;
  const B = 0.75;
  const scored = (query: string, home: string) => {
    const terms = [...new Set(termsOf(query))];
    return docs
      .filter((doc) => doc.overviewId !== home)
      .map((doc) => {
        let score = 0;
        for (const term of terms) {
          const count = doc.terms.get(term);
          if (count === undefined) {
            continue;
          }
          const df = frequency.get(term)!;
          const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
          score += idf * ((count * (K1 + 1)) / (count + K1 * (1 - B + (B * doc.length) / average)));
        }
        return { overviewId: doc.overviewId, passage: doc.passage, score };
      })
      .filter((hit) => hit.score > 0)
      .sort((left, right) => right.score - left.score);
  };
  return {
    sources: (query: string, home: string): string[] => [...new Set(scored(query, home).map((hit) => hit.overviewId))],
    passages: (query: string, home: string, count: number) => scored(query, home).slice(0, count),
  };
};

const keyword = async (dataDir: string, retrievalPath: string): Promise<void> => {
  const library = await loadLibrary(dataDir);
  const { located } = await loadQuestions(dataDir, library);
  const report = JSON.parse(await readFile(retrievalPath, "utf-8")) as { rows: RetrievalRow[] };
  const byId = new Map(located.map((question) => [question.id, question]));
  const search = keywordIndex(library);
  const rows = report.rows
    .filter((row) => row.kind !== "notInLibrary" && row.kind !== "notInSource")
    .map((row) => {
      const order = search.sources(byId.get(row.id)!.question, row.home);
      const ranks = row.expected.map((id) => order.indexOf(id)).filter((rank) => rank >= 0);
      return { row, keywordRank: ranks.length === 0 ? null : Math.min(...ranks) + 1, order };
    });
  const hit = (rank: number | null, depth: number) => rank !== null && rank <= depth;
  const either = (entry: (typeof rows)[number], depth: number) =>
    entry.row.expected.some((id) => entry.row.claimOrder.slice(0, depth).includes(id) || entry.order.slice(0, depth).includes(id));
  const line = (label: string, subset: typeof rows) =>
    `| ${label} | ${subset.length} | ${DEPTHS.map((depth) => subset.filter((entry) => hit(entry.row.claimRank, depth)).length).join(" | ")} | ${DEPTHS.map((depth) => subset.filter((entry) => hit(entry.keywordRank, depth)).length).join(" | ")} | ${DEPTHS.map((depth) => subset.filter((entry) => either(entry, depth)).length).join(" | ")} | ${DEPTHS.map((depth) => subset.filter((entry) => hit(entry.row.passageRank, depth)).length).join(" | ")} |`;
  console.log(
    [
      "| Kind | Questions | Claims 3 | 5 | 8 | Keywords 3 | 5 | 8 | Claims or keywords 3 | 5 | 8 | Passage vectors 3 | 5 | 8 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...[...new Set(rows.map((entry) => entry.row.kind))].map((kind) =>
        line(
          kind,
          rows.filter((entry) => entry.row.kind === kind),
        ),
      ),
      line("All", rows),
    ].join("\n"),
  );
  for (const entry of rows.filter((candidate) => !hit(candidate.row.claimRank, 8))) {
    console.log(`claim miss ${entry.row.id}: keywords rank ${entry.keywordRank ?? "none"}, passage vectors rank ${entry.row.passageRank}`);
  }
};

// The library's transcripts in Postgres, indexed by the shipped repository (OV-352).
const keywordStore = async (library: Library) => {
  const sql = createPgliteSqlClient(createTestPglite());
  await runMigrations(sql, { before: migrationSteps() });
  await sql.query("insert into accounts (id, email) values ($1, 'reader@example.invalid')", [ACCOUNT]);
  const videoOf = new Map<string, string>();
  const overviewOf = new Map<string, string>();
  for (const entry of library.overviews.values()) {
    const key = sourceKey(entry.overview.source);
    if (key === null || entry.segments === null || videoOf.has(entry.id)) {
      continue;
    }
    videoOf.set(entry.id, key);
    overviewOf.set(key, entry.id);
    const body = makeStoredTranscript({ videoId: VideoId.parse(key), segments: entry.segments });
    await sql.query(
      "insert into account_transcripts (account_id, video_id, body, stored_at) values ($1, $2, $3::jsonb, now()) on conflict do nothing",
      [ACCOUNT, key, JSON.stringify(body)],
    );
  }
  const repository = new TranscriptPassagesRepository(sql);
  const started = performance.now();
  await repository.backfill(ACCOUNT);
  return { sql, repository, videoOf, overviewOf, indexMs: performance.now() - started };
};

// OV-352: the shipped keyword search, Postgres full text over stored minute passages, against the
// harness's BM25: where it ranks each question's source, and how long a search takes, with the
// alternative of reading every transcript and scoring it per question timed beside it.
const pgKeyword = async (dataDir: string, retrievalPath: string): Promise<void> => {
  const library = await loadLibrary(dataDir);
  const { located } = await loadQuestions(dataDir, library);
  const report = JSON.parse(await readFile(retrievalPath, "utf-8")) as { rows: RetrievalRow[] };
  const byId = new Map(located.map((question) => [question.id, question]));
  const { sql, repository, videoOf, overviewOf, indexMs } = await keywordStore(library);
  const [{ passages, bytes }] = (await sql.query<{ passages: number; bytes: number }>(
    "select count(*)::int as passages, pg_total_relation_size('transcript_passages')::int as bytes from transcript_passages",
  )) as [{ passages: number; bytes: number }];
  let started = performance.now();
  const timings: number[] = [];
  const computedTimings: number[] = [];
  const ranked: Array<{ row: RetrievalRow; rank: number | null; order: string[] }> = [];
  for (const row of report.rows.filter((candidate) => candidate.kind !== "notInLibrary" && candidate.kind !== "notInSource")) {
    const question = byId.get(row.id)!.question;
    const home = videoOf.get(row.home);
    started = performance.now();
    const hits = await repository.search(ACCOUNT, question, { limit: 40, except: home === undefined ? [] : [home] });
    timings.push(performance.now() - started);
    const order = [...new Set(hits.flatMap((hit) => overviewOf.get(hit.videoId) ?? []))];
    const ranks = row.expected.map((id) => order.indexOf(id)).filter((rank) => rank >= 0);
    ranked.push({ row, rank: ranks.length === 0 ? null : Math.min(...ranks) + 1, order });
    started = performance.now();
    await sql.query<{ body: unknown }>("select body from account_transcripts where account_id = $1", [ACCOUNT]);
    keywordIndex(library).passages(question, row.home, 8);
    computedTimings.push(performance.now() - started);
  }
  const hit = (rank: number | null, depth: number) => rank !== null && rank <= depth;
  const either = (entry: (typeof ranked)[number], depth: number) =>
    entry.row.expected.some((id) => entry.row.claimOrder.slice(0, depth).includes(id) || entry.order.slice(0, depth).includes(id));
  const sorted = (values: number[]) => [...values].sort((left, right) => left - right);
  const at = (values: number[], share: number) => sorted(values)[Math.min(values.length - 1, Math.floor(values.length * share))]!;
  console.log(`${passages} passages, index ${(bytes / 1e6).toFixed(1)} MB, cut and indexed in ${(indexMs / 1000).toFixed(1)} s`);
  console.log(
    `stored search: median ${at(timings, 0.5).toFixed(0)} ms, p90 ${at(timings, 0.9).toFixed(0)} ms, max ${Math.max(...timings).toFixed(0)} ms`,
  );
  console.log(
    `computed per question (read every transcript, score in code): median ${at(computedTimings, 0.5).toFixed(0)} ms, p90 ${at(computedTimings, 0.9).toFixed(0)} ms`,
  );
  console.log(
    [
      "| Kind | Questions | Postgres 3 | 5 | 8 | Claims or Postgres 3 | 5 | 8 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...[...new Set(ranked.map((entry) => entry.row.kind)), "All"].map((kind) => {
        const subset = kind === "All" ? ranked : ranked.filter((entry) => entry.row.kind === kind);
        return `| ${kind} | ${subset.length} | ${DEPTHS.map((depth) => subset.filter((entry) => hit(entry.rank, depth)).length).join(" | ")} | ${DEPTHS.map((depth) => subset.filter((entry) => either(entry, depth)).length).join(" | ")} |`;
      }),
    ].join("\n"),
  );
  for (const entry of ranked.filter((candidate) => !hit(candidate.row.claimRank, 8))) {
    console.log(`claim miss ${entry.row.id}: Postgres rank ${entry.rank ?? "none"}`);
  }
};

// The reply as the scoring below reads it, from the shape every chat now gives (OV-354): its text
// flattened, and its ids by kind.
type ScoredReply = CitedIds & { answer: string; generalKnowledge: boolean };
const scoredReply = (reply: ChatReply): ScoredReply => ({
  ...citedIds(allIds(reply), reply.inSource),
  answer: [
    reply.intro,
    ...reply.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.numbered, ...section.bullets]),
    reply.takeaway,
  ]
    .filter((part) => part !== "")
    .join("\n"),
  generalKnowledge: reply.generalKnowledge,
});

// --- answering ---

interface Arm {
  name: string;
  pick: (row: RetrievalRow) => string[];
  transcripts: boolean | "closest" | "keyword" | "keywordNeighbours" | "shipped";
}

const arms = (): Map<string, Arm> => {
  const pinned = (count: number) => (row: RetrievalRow) => {
    const pins = row.expected.slice(0, Math.min(row.expected.length, count));
    for (const id of row.claimOrder) {
      if (pins.length >= count) {
        break;
      }
      if (!pins.includes(id)) {
        pins.push(id);
      }
    }
    return pins;
  };
  const search = (count: number) => (row: RetrievalRow) => row.claimOrder.slice(0, count);
  const list: Arm[] = [
    { name: "home", pick: () => [], transcripts: false },
    // OV-354: each question asked in the chat of the overview it is about, scored on its own
    // transcript: the shipped prompt's own citing, as OV-267 measured it.
    { name: "own", pick: () => [], transcripts: false },
    { name: "search3-full", pick: search(3), transcripts: true },
    { name: "search3-overviews", pick: search(3), transcripts: false },
    { name: "search5-overviews", pick: search(5), transcripts: false },
    { name: "pinned1-overviews", pick: pinned(1), transcripts: false },
    { name: "pinned3-overviews", pick: pinned(3), transcripts: false },
    { name: "pinned8-overviews", pick: pinned(8), transcripts: false },
    { name: "pinned3-full", pick: pinned(3), transcripts: true },
    { name: "search3+passages8", pick: search(3), transcripts: "closest" },
    { name: "search3+keyword8", pick: search(3), transcripts: "keyword" },
    // OV-352: each keyword minute with the minute either side, for "right source, wrong minute".
    { name: "search3+keyword8n", pick: search(3), transcripts: "keywordNeighbours" },
    // The shipped OV-352 search and prompt: Postgres minutes with neighbours, sent by otherSourcesInPrompt.
    { name: "shipped-keyword", pick: search(3), transcripts: "shipped" },
    {
      name: "pinned1+search3-overviews",
      pick: (row) => [...new Set([...row.expected.slice(0, 1), ...search(3)(row)])],
      transcripts: false,
    },
  ];
  return new Map(list.map((arm) => [arm.name, arm]));
};

interface OtherSource {
  label: string;
  overviewId: string;
  title: string;
  passages: Passage[];
  partIds: string[];
}

const PART_ID = /\[((?:verdict|sells|anyway)|(?:dubious|kp|step|apply|ing|method|ch)\d+)\] /g;

// Overviews only, pinned or found, as the shipped chat sends them (OV-355).
const shippedSourcesBlock = (
  library: Library,
  ids: string[],
  pinned: number,
  minutes: ReadonlyMap<string, Passage[]> = new Map(),
): { text: string; sources: OtherSource[] } => {
  const chatSources = ids.map((id, index) => ({
    label: `S${index + 1}`,
    overviewId: id as OverviewId,
    title: library.overviews.get(id)!.overview.source.title,
    how: index < pinned ? ("pinned" as const) : ("found" as const),
  }));
  const overviews = new Map(ids.map((id) => [id, library.overviews.get(id)!.overview]));
  const sent = [...minutes].map(([overviewId, passages]) => ({ overviewId, passages }));
  const text = otherSourcesInPrompt([{ sources: chatSources, setAside: [], minutes: sent }], overviews, new Map()).blocks[0]!;
  return {
    text,
    sources: chatSources.map((source) => ({
      ...otherSourceOf(library, source.overviewId, source.label),
      passages: minutes.get(source.overviewId) ?? [],
    })),
  };
};

const otherSourceOf = (library: Library, id: string, label: string): OtherSource => {
  const entry = library.overviews.get(id)!;
  return {
    label,
    overviewId: id,
    title: entry.overview.source.title ?? id,
    passages: [],
    partIds: overviewParts(entry.overview).map(({ part, index }) => `${label}.${overviewPartId(part, index)}`),
  };
};

const pinnedCount = (armName: string, others: string[]): number =>
  armName.startsWith("pinned1+") ? 1 : armName.startsWith("pinned") ? others.length : 0;

const otherSourcesBlock = (
  library: Library,
  ids: string[],
  wanted: boolean | ReadonlyMap<string, Passage[]>,
): { text: string; sources: OtherSource[] } => {
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
};

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

const answer = async (
  dataDir: string,
  retrievalPath: string,
  outPath: string,
  options: { arms: string[]; runs: number; budget: number; dryRun: boolean; only: string | null },
) => {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!options.dryRun && !apiKey) {
    throw new Error("OPENAI_API_KEY is needed");
  }
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
    for (const { id, passage } of scored) {
      chosen.set(
        id,
        [...(chosen.get(id) ?? []), passage].sort((a, b) => a.startMs - b.startMs),
      );
    }
    return chosen;
  };
  // The keyword shape: the eight minutes that best match the question's words, by BM25 over the
  // transcripts already kept, chosen the same way and sent the same way.
  const keywords = options.arms.some((name) => ["keyword", "keywordNeighbours"].includes(String(all.get(name)?.transcripts)))
    ? keywordIndex(library)
    : null;
  const keywordPassages = (question: Located, home: string, neighbours = false): Map<string, Passage[]> => {
    const chosen = new Map<string, Passage[]>();
    for (const { overviewId, passage } of keywords!.passages(question.question, home, 8)) {
      const all = transcriptPassages(library.overviews.get(overviewId)!.segments!);
      const at = all.findIndex((candidate) => candidate.id === passage.id);
      const wanted = neighbours ? all.slice(Math.max(0, at - 1), at + 2) : [passage];
      const held = chosen.get(overviewId) ?? [];
      chosen.set(
        overviewId,
        [...held, ...wanted.filter((one) => !held.some((other) => other.id === one.id))].sort((a, b) => a.startMs - b.startMs),
      );
    }
    return chosen;
  };
  const store = options.arms.some((name) => all.get(name)?.transcripts === "shipped") ? await keywordStore(library) : null;
  const shippedMinutes = async (question: Located, home: string): Promise<Map<string, Passage[]>> => {
    const homeKey = store!.videoOf.get(home);
    const hits = await store!.repository.search(ACCOUNT, question.question, { limit: 8, except: homeKey === undefined ? [] : [homeKey] });
    const chosen = new Map<string, Passage[]>();
    for (const hit of hits) {
      const overviewId = store!.overviewOf.get(hit.videoId);
      if (overviewId === undefined) {
        continue;
      }
      const held = chosen.get(overviewId) ?? [];
      chosen.set(
        overviewId,
        [...held, ...hit.around.filter((one) => !held.some((other) => other.id === one.id))].sort((a, b) => a.startMs - b.startMs),
      );
    }
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
    if (arm === undefined) {
      throw new Error(`no arm ${armName}: ${[...all.keys()].join(", ")}`);
    }
    for (let run = 1; run <= options.runs; run += 1) {
      for (const row of retrievalRows) {
        const question = byId.get(row.id);
        if (question === undefined) {
          continue;
        }
        if (options.only !== null && !new RegExp(options.only).test(question.kind)) {
          continue;
        }
        if (seen.has(key(arm.name, run, row.id))) {
          continue;
        }
        const ownId = arm.name === "own" && question.expected.length === 1 ? question.expected[0]! : row.home;
        if (arm.name === "own" && (question.kind === "notInLibrary" || question.kind === "applyAcross")) {
          continue;
        }
        const home = library.overviews.get(ownId)!;
        const kind = chatSourceKind(home.overview);
        const homePassages = home.segments === null ? [] : transcriptPassages(home.segments);
        const closest =
          arm.transcripts === "closest"
            ? closestPassages(question, row.home)
            : arm.transcripts === "keyword" || arm.transcripts === "keywordNeighbours"
              ? keywordPassages(question, row.home, arm.transcripts === "keywordNeighbours")
              : arm.transcripts === "shipped"
                ? await shippedMinutes(question, row.home)
                : null;
        const others = [...new Set([...arm.pick(row), ...(closest?.keys() ?? [])])].filter((id) => id !== row.home);
        const system = chatSystemPrompt(kind, overviewMarkdown(home.overview, { partIds: true }), homePassages, {
          recipe: home.overview.recipe !== null,
        });
        const block =
          others.length === 0
            ? null
            : arm.transcripts === false
              ? shippedSourcesBlock(library, others, pinnedCount(arm.name, others))
              : arm.transcripts === "shipped"
                ? shippedSourcesBlock(library, others, 0, closest!)
                : otherSourcesBlock(library, others, closest ?? arm.transcripts === true);
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
          for await (const piece of stream.pieces) {
            raw += piece;
          }
          const reply = scoredReply(ChatReply.parse(JSON.parse(raw)));
          const usage = stream.usage();
          const own = arm.name === "own";
          turn = score(
            arm.name,
            run,
            question,
            row,
            others,
            own
              ? [
                  {
                    label: "H",
                    overviewId: ownId,
                    title: home.overview.source.title,
                    passages: homePassages,
                    partIds: overviewParts(home.overview).map(({ part, index }) => `H.${overviewPartId(part, index)}`),
                  },
                ]
              : (block?.sources ?? []),
            homePassages,
            own
              ? {
                  ...reply,
                  passages: reply.passages.map((id) => (/^p\d+$/.test(id) ? `H.${id}` : id)),
                  overviewParts: reply.overviewParts.map((id) => (id.includes(".") ? id : `H.${id}`)),
                }
              : reply,
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
        if (done.length % 10 === 0) {
          await writeFile(outPath, `${JSON.stringify(done, null, 1)}\n`);
        }
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
};

const score = (
  arm: string,
  run: number,
  question: Located,
  row: RetrievalRow,
  others: string[],
  sources: OtherSource[],
  homePassages: Passage[],
  reply: ScoredReply,
  usage: TokenUsage | null,
  price: NonNullable<ReturnType<typeof priceOf>>,
  ms: number,
): AnswerTurn => {
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
          if (source === undefined) {
            return false;
          }
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
};

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
const libraryMap = (library: Library, withKeyPoints: boolean): { text: string; labels: Map<string, string>; partIds: Set<string> } => {
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
};

const mapArm = async (
  dataDir: string,
  library: Library,
  outPath: string,
  armName: string,
  options: { runs: number; budget: number; dryRun: boolean; spent: number; apiKey: string },
): Promise<number> => {
  const withKeyPoints = armName === "map-keypoints";
  if (!withKeyPoints && armName !== "map-compact") {
    throw new Error(`no arm ${armName}`);
  }
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
      if (done.some((turn) => turn.arm === armName && turn.run === run && turn.id === question.id)) {
        continue;
      }
      if (spent >= options.budget) {
        console.error(`budget of $${options.budget} reached at $${spent.toFixed(4)}`);
        break;
      }
      const core = question.core.map(resolve);
      const relevant = new Set([...core, ...question.relevant.map(resolve)]);
      if (question.recipesRelevant) {
        for (const entry of library.overviews.values()) {
          if (entry.overview.recipe !== null) {
            relevant.add(entry.id);
          }
        }
      }
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
        for await (const piece of stream.pieces) {
          raw += piece;
        }
        const reply = scoredReply(ChatReply.parse(JSON.parse(raw)));
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
};

const mapMarkdown = (turns: MapTurn[]): string => {
  return [
    "| Arm | Question | Run | Overviews cited | Topics among them | Ids not in the library | On the subject | Core overviews found | Prompt tokens | First message | Cached follow-up |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...turns.map(
      (turn) =>
        `| ${turn.arm} | ${turn.id} | ${turn.run} | ${turn.failed ? "FAILED" : turn.cited.length} | ${turn.topicsCited} | ${turn.invalidIds.length} | ${turn.precision === null ? "—" : `${Math.round(turn.precision * 100)}%`} | ${turn.coreFound === null ? "—" : `${turn.coreFound}/${turn.coreTotal}`} | ${turn.inputTokens} | $${turn.costDollars.toFixed(5)} | $${turn.followUpDollars.toFixed(5)} |`,
    ),
  ].join("\n");
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]!;
};

const answerMarkdown = (turns: AnswerTurn[]): string => {
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
};

// --- a project: its own chat, and pinned with "@" in an overview's chat ---

type ProjectKind = "synthesis" | "detail" | "purpose" | "outside" | "atProject";

interface ProjectQuestion {
  id: string;
  project: string;
  kind: ProjectKind;
  question: string;
  core: string[];
  mentions: string[];
  home?: string;
}

interface ProjectTurn {
  arm: string;
  run: number;
  id: string;
  kind: ProjectKind;
  project: string;
  members: number;
  failed: boolean;
  cited: string[];
  citedNonMembers: number;
  invalidIds: string[];
  coreFound: number | null;
  coreTotal: number;
  mentioned: boolean | null;
  gaveCount: boolean;
  answer: string;
  inputTokens: number;
  outputTokens: number;
  costDollars: number;
  followUpDollars: number;
  ms: number;
}

const BRIEF_FULL = 5;
const PINNED_WHOLE = 8;
const COUNTED =
  /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(of (these|the|your) )?(overviews|videos|recipes|sources|desserts|dinners|items)\b/i;

const briefLine = (label: string, entry: LibraryOverview) =>
  [`## [${label}] ${entry.overview.source.title ?? ""}`, entry.overview.bigPicture ?? "", entry.overview.coreClaim]
    .filter((line) => line !== "")
    .join("\n");

// A project page's chat: its overviews whole, or compact as in the library map, with the
// reader's purpose for it or without, and with the minutes of its transcripts that best match
// the question's words or without.
const projectMaterial = (
  library: Library,
  { project, members }: LibraryProject,
  options: { whole: boolean; purpose: boolean; passages: ReadonlyMap<string, Passage[]> | null },
): { text: string; labels: Map<string, string>; partIds: Set<string> } => {
  const labels = new Map<string, string>();
  const partIds = new Set<string>();
  const blocks = members.map((id, index) => {
    const label = `O${index + 1}`;
    labels.set(label, id);
    const entry = library.overviews.get(id)!;
    let body: string;
    if (options.whole) {
      for (const { part, index: at } of overviewParts(entry.overview)) {
        partIds.add(`${label}.${overviewPartId(part, at)}`);
      }
      body = `## [${label}]\n\n${overviewMarkdown(entry.overview, { partIds: true }).replace(PART_ID, (_, part: string) => `[${label}.${part}] `)}`;
    } else {
      body = briefLine(label, entry);
    }
    const passages = options.passages?.get(id) ?? [];
    for (const passage of passages) {
      partIds.add(`${label}.${passage.id}`);
    }
    const minutes =
      passages.length === 0
        ? ""
        : `\n\nMinutes of its transcript that match the question:\n${passages.map((passage) => `[${label}.${passage.id} ${formatClock(passage.startMs / 1000)}] ${passage.text}`).join("\n")}`;
    return `${body}${minutes}`;
  });
  const shown = options.whole
    ? "Each is given in full, and its items carry their own ids (such as O12.kp3)"
    : "Each shows its title, its big picture and its core claim";
  const purpose =
    options.purpose && project.purpose !== null
      ? ` The reader keeps it for this, in their own words: "${project.purpose}". Fit answers to that purpose.`
      : "";
  const text = `You answer a reader's questions about one of their projects in The Overview, "${project.name}": the overviews they have gathered in it, listed below.${purpose} Each overview has an id (O1, O2 and so on). ${shown}.${options.passages === null ? "" : " Some also carry minutes of their transcript, with ids such as O12.p14."}

Answer from the project below. Answer in up to eight short sentences, or a short list when the question asks for several things.
- Name each overview you draw on by its title, and list in overviewParts the ids the answer rests on (an overview's id${options.whole ? ", or an item's id" : ""}).${options.passages === null ? "" : " List transcript minute ids in passages."}
- Never give a count of overviews, or a share of the project: say "several" or "most" instead.
- When the project doesn't cover what the question asks, say so plainly, and never invent an overview.
- When overviews disagree, say which ones, and how.
- There is no single source here: always set inSource to false, leave chatMessages empty${options.passages === null ? " and passages empty" : ""}, and set generalKnowledge to false unless you add something from beyond the project, which you mark as such.

# The project

${blocks.join("\n\n")}`;
  return { text, labels, partIds };
};

// "@" a project in an overview's chat: a small project goes in whole, as pins do; a larger one
// sends its closest few whole and the rest in brief, so the prompt stays bounded.
const pinnedProjectBlock = (
  library: Library,
  { project, members }: LibraryProject,
  home: string,
  closest: string[],
  capped: boolean,
): { text: string; labelled: Map<string, string>; sources: OtherSource[] } => {
  const others = members.filter((id) => id !== home);
  const whole = !capped || others.length <= PINNED_WHOLE ? others : closest.filter((id) => others.includes(id)).slice(0, BRIEF_FULL);
  const ordered = [...whole, ...others.filter((id) => !whole.includes(id))];
  const chatSources = ordered.map((id, index) => ({
    label: `S${index + 1}`,
    overviewId: id as OverviewId,
    title: library.overviews.get(id)!.overview.source.title,
    how: "pinned" as const,
    projectId: project.id,
    ...(whole.includes(id) ? {} : { brief: true }),
  }));
  const overviews = new Map(ordered.map((id) => [id, library.overviews.get(id)!.overview]));
  const text = otherSourcesInPrompt([{ sources: chatSources, setAside: [] }], overviews, new Map([[project.id, project]])).blocks[0]!;
  return {
    text,
    labelled: new Map(chatSources.map((source) => [source.label, source.overviewId])),
    sources: chatSources.filter((source) => source.brief !== true).map((source) => otherSourceOf(library, source.overviewId, source.label)),
  };
};

const projectChat = async (
  dataDir: string,
  outPath: string,
  options: { arms: string[]; runs: number; budget: number; dryRun: boolean; only: string | null },
): Promise<void> => {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!options.dryRun && !apiKey) {
    throw new Error("OPENAI_API_KEY is needed");
  }
  const library = await loadLibrary(dataDir);
  const file = JSON.parse(await readFile(join(dataDir, "projects.json"), "utf-8")) as {
    questions: ProjectQuestion[];
    atProject: Array<Omit<ProjectQuestion, "kind">>;
  };
  const resolve = (prefix: string) => [...library.overviews.keys()].find((id) => id.startsWith(prefix)) ?? prefix;
  const projectOf = (prefix: string) => [...library.projects.values()].find((entry) => entry.project.id.startsWith(prefix))!;
  const price = priceOf(chatModel)!;
  const done: ProjectTurn[] = JSON.parse((await readFile(outPath, "utf-8").catch(() => "[]")) as string) as ProjectTurn[];
  let spent = done.reduce((total, turn) => total + turn.costDollars, 0);
  let ceiling = 0;
  const atQuestions = file.atProject.map((question) => ({ ...question, kind: "atProject" as const }));
  const needsVectors = options.arms.includes("at-project") && !options.dryRun;
  const vectors = needsVectors
    ? (
        await cachedEmbeddings(
          join(dataDir, "project-questions.json"),
          atQuestions.map((question) => question.question.trim().toLowerCase()),
          apiKey!,
        )
      ).vectors
    : new Map<string, number[]>();
  const closestMembers = (question: ProjectQuestion, members: string[]): string[] => {
    const vector = vectors.get(question.question.trim().toLowerCase());
    if (vector === undefined) {
      return members;
    }
    const best = (id: string) => Math.max(...(library.claimVectors.get(id) ?? []).map((claim) => cosine(vector, claim)), -1);
    return [...members].sort((left, right) => best(right) - best(left));
  };

  for (const armName of options.arms) {
    const pinned = armName === "at-project" || armName === "at-project-full";
    const questions: ProjectQuestion[] = pinned ? atQuestions : file.questions;
    for (let run = 1; run <= options.runs; run += 1) {
      for (const question of questions) {
        if (options.only !== null && !new RegExp(options.only).test(question.id)) {
          continue;
        }
        if (done.some((turn) => turn.arm === armName && turn.run === run && turn.id === question.id)) {
          continue;
        }
        const entry = projectOf(question.project);
        let messages: PromptMessage[];
        let citedOf: (reply: ScoredReply) => { cited: string[]; invalid: string[] };
        if (pinned) {
          const home = library.overviews.get(resolve(question.home!))!;
          const block = pinnedProjectBlock(library, entry, home.id, closestMembers(question, entry.members), armName === "at-project");
          const homePassages = home.segments === null ? [] : transcriptPassages(home.segments);
          messages = [
            {
              role: "system",
              content: chatSystemPrompt(chatSourceKind(home.overview), overviewMarkdown(home.overview, { partIds: true }), homePassages, {
                recipe: home.overview.recipe !== null,
              }),
            },
            { role: "user", content: block.text },
            { role: "user", content: question.question },
          ];
          citedOf = (reply) => {
            const ids = [...new Set([...reply.overviewParts, ...reply.passages])];
            const cited = [
              ...new Set(
                ids.flatMap((id) => {
                  const label = /^S\d+/.exec(id)?.[0];
                  return label === undefined ? [] : (block.labelled.get(label) ?? []);
                }),
              ),
            ];
            const invalid = ids.filter((id) => /^S\d+/.test(id) && !block.labelled.has(/^S\d+/.exec(id)![0]));
            return { cited, invalid };
          };
        } else {
          const whole = armName === "project-full";
          const keywordArm = armName === "project-map+keyword8";
          if (!["project-full", "project-map", "project-map-nopurpose", "project-map+keyword8"].includes(armName)) {
            throw new Error(`no arm ${armName}`);
          }
          let passages: Map<string, Passage[]> | null = null;
          if (keywordArm) {
            const within: Library = { ...library, overviews: new Map(entry.members.map((id) => [id, library.overviews.get(id)!])) };
            passages = new Map();
            for (const { overviewId, passage } of keywordIndex(within).passages(question.question, "", 8)) {
              passages.set(
                overviewId,
                [...(passages.get(overviewId) ?? []), passage].sort((a, b) => a.startMs - b.startMs),
              );
            }
          }
          const material = projectMaterial(library, entry, { whole, purpose: armName !== "project-map-nopurpose", passages });
          messages = [
            { role: "system", content: material.text },
            { role: "user", content: question.question },
          ];
          citedOf = (reply) => {
            const ids = [...new Set([...reply.overviewParts, ...reply.passages])];
            return {
              cited: [...new Set(ids.flatMap((id) => material.labels.get(id.split(".")[0]!) ?? []))],
              invalid: ids.filter((id) => !material.labels.has(id) && !material.partIds.has(id)),
            };
          };
        }
        const characters = messages.reduce((total, message) => total + message.content.length, 0);
        if (options.dryRun) {
          if (process.env["SHOW"] === question.id && run === 1) {
            console.log(messages.map((m) => `=== ${m.role}\n${m.content}`).join("\n\n"));
          }
          if (run === 1) {
            console.log(`${armName} ${question.id}: ${entry.members.length} members, about ${Math.round(characters / 4)} prompt tokens`);
          }
          ceiling += (characters / 4) * (0.125 / 1_000_000) + (700 * price.perMillion.output) / 1_000_000;
          continue;
        }
        if (spent >= options.budget) {
          console.error(`budget of $${options.budget} reached at $${spent.toFixed(4)}`);
          break;
        }
        const startedAt = Date.now();
        const base = {
          arm: armName,
          run,
          id: question.id,
          kind: question.kind,
          project: entry.project.name,
          members: entry.members.length,
        };
        let turn: ProjectTurn;
        try {
          const stream = await streamChatCompletion(
            { apiKey: apiKey!, http: fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), retried: () => {} },
            messages,
            `ov307-${armName}-${run}-${question.id}`,
            // MAX_TOKENS raises the cap, to tell a reply cut off at it from one the model left empty.
            process.env["MAX_TOKENS"] === undefined
              ? undefined
              : { name: "chat_reply", schema: CHAT_REPLY_SCHEMA, maxTokens: Number(process.env["MAX_TOKENS"]) },
          );
          let raw = "";
          for await (const piece of stream.pieces) {
            raw += piece;
          }
          if (stream.finishReason() === "length") {
            throw new Error(`cut off at the cap, ${stream.usage()?.outputTokens ?? "?"} output tokens`);
          }
          const reply = scoredReply(ChatReply.parse(JSON.parse(raw)));
          const usage = stream.usage();
          const { cited, invalid } = citedOf(reply);
          const core = question.core.map(resolve);
          const text = withoutCitationMarks(reply.answer);
          const inputTokens = usage === null ? 0 : promptTokensOf(usage);
          turn = {
            ...base,
            failed: false,
            cited,
            citedNonMembers: cited.filter((id) => !entry.members.includes(id)).length,
            invalidIds: invalid,
            coreFound: core.length === 0 ? null : core.filter((id) => cited.includes(id)).length,
            coreTotal: core.length,
            mentioned:
              question.mentions.length === 0 ? null : question.mentions.some((term) => text.toLowerCase().includes(term.toLowerCase())),
            gaveCount: COUNTED.test(text),
            answer: text,
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
            ...base,
            failed: true,
            cited: [],
            citedNonMembers: 0,
            invalidIds: [],
            coreFound: null,
            coreTotal: question.core.length,
            mentioned: null,
            gaveCount: false,
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
          `${armName} r${run} ${question.id} ${turn.failed ? "FAILED" : `$${turn.costDollars.toFixed(5)} cited ${turn.cited.length}${turn.coreTotal > 0 ? ` core ${turn.coreFound}/${turn.coreTotal}` : ""}`}`,
        );
      }
    }
  }
  if (options.dryRun) {
    console.log(`dry run: ceiling about $${ceiling.toFixed(2)} (characters / 4 at $0.125/M uncached, 700 output tokens each)`);
    return;
  }
  console.log(projectMarkdown(done));
  console.error(`spent $${spent.toFixed(4)} in all`);
};

const projectMarkdown = (turns: ProjectTurn[]): string => {
  const keys = [...new Set(turns.map((turn) => `${turn.arm}|${turn.project}`))];
  const count = (subset: ProjectTurn[], test: (turn: ProjectTurn) => boolean | null) => {
    const scored = subset.filter((turn) => test(turn) !== null);
    return scored.length === 0 ? "—" : `${scored.filter((turn) => test(turn) === true).length}/${scored.length}`;
  };
  return [
    "| Arm | Project | Overviews | Cut off | Prompt tokens | First message | Cached follow-up | Core found | Detail cited | Detail named | Outside: cited none | Gave a count | Bad ids |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...keys.map((key) => {
      const [arm, project] = key.split("|");
      const all = turns.filter((turn) => turn.arm === arm && turn.project === project);
      const subset = all.filter((turn) => !turn.failed);
      const core = subset.filter((turn) => turn.coreFound !== null);
      const found = core.reduce((total, turn) => total + turn.coreFound!, 0);
      const total = core.reduce((sum, turn) => sum + turn.coreTotal, 0);
      const detail = subset.filter((turn) => turn.kind === "detail");
      return `| ${arm} | ${project} | ${all[0]?.members ?? 0} | ${all.length - subset.length}/${all.length} | ${median(subset.map((turn) => turn.inputTokens))} | $${median(subset.map((turn) => turn.costDollars)).toFixed(5)} | $${median(subset.map((turn) => turn.followUpDollars)).toFixed(5)} | ${total === 0 ? "—" : `${found}/${total}`} | ${count(detail, (turn) => (turn.coreFound === null ? null : turn.coreFound > 0))} | ${count(detail, (turn) => turn.mentioned)} | ${count(
        subset.filter((turn) => turn.kind === "outside"),
        (turn) => turn.cited.length === 0,
      )} | ${count(subset, (turn) => turn.gaveCount)} | ${subset.reduce((sum, turn) => sum + turn.invalidIds.length, 0)} |`;
    }),
  ].join("\n");
};

// --- structured answers, and a second pass that reads the chosen overviews whole ---

const STRUCTURED_ANSWER_TOKENS = 2_000;
const PICKS = 5;
// Luna's reasoning counts against the cap, and broad questions reason longest: 300 cut off 4 in 17.
const PICK_TOKENS = 1_000;

const STRUCTURED_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intro", "sections", "takeaway"],
  properties: {
    intro: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "points"],
        properties: {
          heading: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "sources"],
              properties: { text: { type: "string" }, sources: { type: "array", items: { type: "string" } } },
            },
          },
        },
      },
    },
    takeaway: { type: "string" },
  },
} as const;

const PICK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overviews"],
  properties: { overviews: { type: "array", items: { type: "string" } } },
} as const;

interface StructuredAnswer {
  intro: string;
  sections: Array<{ heading: string; points: Array<{ text: string; sources: string[] }> }>;
  takeaway: string;
}

// The shared reply shape (OV-354) scored as the older points were: each section one point, its text
// the paragraphs and lists, its sources every id the section names. The intro's sources join as a point.
const asPoints = (json: unknown): StructuredAnswer => {
  const sections = (json as { sections: Array<Record<string, unknown>> }).sections;
  if (sections.every((section) => Array.isArray(section["points"]))) {
    return json as StructuredAnswer;
  }
  const shared = json as ChatReply;
  return {
    intro: shared.intro,
    sections: [
      ...(shared.introSources.length === 0
        ? []
        : [{ heading: "", points: [{ text: shared.intro, sources: shared.introSources.map((source) => source.id) }] }]),
      ...shared.sections.map((section) => ({
        heading: section.heading,
        points: [
          {
            text: [...section.paragraphs, ...section.numbered, ...section.bullets].join(" "),
            sources: section.sources.map((source) => source.id),
          },
        ],
      })),
    ],
    takeaway: shared.takeaway,
  };
};

interface TwoPassQuestion {
  id: string;
  scope: string;
  question: string;
  core: string[];
}

interface TwoPassTurn {
  arm: string;
  run: number;
  id: string;
  scope: string;
  failed: boolean;
  picked: string[];
  coreInPicks: number | null;
  cited: string[];
  coreFound: number | null;
  coreTotal: number;
  sections: number;
  points: number;
  pointsWithoutSources: number;
  pointsComparing: number;
  invalidIds: string[];
  weakPoints: Array<{ text: string; sources: string[]; overlap: number }>;
  gaveCount: boolean;
  answer: StructuredAnswer | string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  costDollars: number;
  ms: number;
}

const completeJson = async (
  apiKey: string,
  messages: PromptMessage[],
  schema: object,
  maxTokens: number,
  cacheKey: string,
): Promise<{ json: unknown; usage: TokenUsage | null }> => {
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
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    throw new Error(`The provider answered ${response.status}`);
  }
  const body = (await response.json()) as { choices: Array<{ message: { content: string | null }; finish_reason: string }> };
  const usage = tokenUsageOf("openai", body);
  const choice = body.choices[0]!;
  if (choice.finish_reason === "length") {
    throw Object.assign(new Error("cut off at the answer cap"), { usage });
  }
  return { json: JSON.parse(choice.message.content ?? ""), usage };
};

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

const contentWords = (text: string) => termsOf(text).filter((word) => word.length > 4);

// The library or a project as the compact map, with one system message that serves both passes,
// so the second pass reads the map from the cache.
const twoPassSystem = (library: Library, scope: string): { text: string; labels: Map<string, string>; order: string[] } => {
  const project = scope === "library" ? null : [...library.projects.values()].find((entry) => entry.project.id.startsWith(scope))!;
  const order = project === null ? [...library.overviews.keys()] : project.members;
  const labels = new Map(order.map((id, index) => [`O${index + 1}`, id]));
  const blocks = order.map((id, index) => briefLine(`O${index + 1}`, library.overviews.get(id)!));
  const where =
    project === null
      ? "their whole library in The Overview: every overview they have saved"
      : `one of their projects in The Overview, "${project.project.name}"${project.project.purpose === null ? "" : `, which they keep for this: "${project.project.purpose}"`}`;
  const text = `You answer a reader's questions about ${where}, listed below in brief. Each overview has an id (O1, O2 and so on) and shows its title, its big picture and its core claim.

Sometimes you are first asked to choose the overviews whose full notes you need. Choose up to ${PICKS}, the ones the answer will rest on, and return their ids. You may then be given those overviews in full, with their items' ids (such as O12.kp3).

Answer in this shape:
- intro: one or two sentences that answer the question.
- sections: two to four, each with a short heading and one to three points. Each point is one or two sentences. Its sources list the ids it rests on: an overview's id, or an item's id from the full notes. A point that compares or connects overviews lists every one of them.
- takeaway: one sentence.

Rules:
- Name overviews by their titles only where the sentence needs it; the sources carry the citation.
- Never give a count of overviews, or a share of them: say "several" or "most" instead.
- Use only what the overviews say. Where you connect them, say it is your connection, not theirs.
- When they disagree, say which ones, and how.
- When nothing here covers the question, say so in the intro and leave sections empty.

# The overviews

${blocks.join("\n\n")}`;
  return { text, labels, order };
};

// The shipped material (OV-353): whole while it fits, else the map, with the production prompt.
const shippedSystem = (
  library: Library,
  scope: string,
): { text: string; labels: Map<string, string>; order: string[]; mode: "whole" | "map" } => {
  const project = scope === "library" ? null : [...library.projects.values()].find((entry) => entry.project.id.startsWith(scope))!;
  const ids = project === null ? [...library.overviews.keys()] : project.members;
  const inOrder = ids.map((id) => library.overviews.get(id)!.overview);
  // ORDER=export keeps the export's order, to tell the order apart from the prompt.
  const overviews =
    process.env["ORDER"] === "export" ? inOrder : [...inOrder].sort((left, right) => left.savedAt.localeCompare(right.savedAt));
  const material = libraryChatMaterial(project === null ? { kind: "library" } : { kind: "project", project: project.project }, overviews);
  const labels = new Map([...material.labels].map(([label, overview]) => [label, overview.id as string]));
  return { text: material.system, labels, order: [...labels.values()], mode: material.mode };
};

const twoPass = async (
  dataDir: string,
  outPath: string,
  options: { arms: string[]; runs: number; budget: number; dryRun: boolean; only: string | null },
): Promise<void> => {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!options.dryRun && !apiKey) {
    throw new Error("OPENAI_API_KEY is needed");
  }
  const library = await loadLibrary(dataDir);
  const resolve = (prefix: string) => [...library.overviews.keys()].find((id) => id.startsWith(prefix)) ?? prefix;
  const synthesis = (JSON.parse(await readFile(join(dataDir, "synthesis.json"), "utf-8")) as { questions: SynthesisQuestion[] }).questions;
  const projects = (JSON.parse(await readFile(join(dataDir, "projects.json"), "utf-8")) as { questions: ProjectQuestion[] }).questions;
  const questions: TwoPassQuestion[] = [
    ...synthesis.map((question) => ({ id: question.id, scope: "library", question: question.question, core: question.core.map(resolve) })),
    { id: "s-novel", scope: "library", question: "Tell me something novel that connects my overviews.", core: [] },
    ...projects
      .filter((question) => question.kind === "synthesis" || question.kind === "purpose")
      .map((question) => ({ id: question.id, scope: question.project, question: question.question, core: question.core.map(resolve) })),
  ];
  const price = priceOf(chatModel)!;
  const done: TwoPassTurn[] = JSON.parse((await readFile(outPath, "utf-8").catch(() => "[]")) as string) as TwoPassTurn[];
  let spent = done.reduce((total, turn) => total + turn.costDollars, 0);
  let ceiling = 0;

  for (const armName of options.arms) {
    if (armName !== "structured-map" && armName !== "two-pass" && armName !== "shipped") {
      throw new Error(`no arm ${armName}`);
    }
    for (let run = 1; run <= options.runs; run += 1) {
      for (const question of questions) {
        if (options.only !== null && !new RegExp(options.only).test(question.id)) {
          continue;
        }
        if (done.some((turn) => turn.arm === armName && turn.run === run && turn.id === question.id)) {
          continue;
        }
        const shipped = armName === "shipped" ? shippedSystem(library, question.scope) : null;
        const system = shipped ?? twoPassSystem(library, question.scope);
        if (options.dryRun) {
          const tokens = system.text.length / 4;
          ceiling +=
            armName === "two-pass"
              ? tokens * (0.125 / 1e6) + tokens * (0.01 / 1e6) + 12_000 * (0.125 / 1e6) + 1_600 * (price.perMillion.output / 1e6)
              : tokens * (0.125 / 1e6) + 1_500 * (price.perMillion.output / 1e6);
          if (run === 1) {
            console.log(`${armName} ${question.id}: about ${Math.round(tokens)} map tokens`);
          }
          continue;
        }
        if (spent >= options.budget) {
          console.error(`budget of $${options.budget} reached at $${spent.toFixed(4)}`);
          break;
        }
        const startedAt = Date.now();
        const key = `ov307-twopass-${question.scope}`;
        let usage: TokenUsage | null = null;
        let picked: string[] = [];
        const partIds = new Set<string>();
        const texts = new Map<string, string>();
        for (const [label, id] of system.labels) {
          texts.set(label, briefLine(label, library.overviews.get(id)!));
        }
        let turn: TwoPassTurn;
        try {
          const messages: PromptMessage[] = [{ role: "system", content: system.text }];
          if (shipped?.mode === "whole") {
            for (const [label, id] of system.labels) {
              const entry = library.overviews.get(id)!;
              for (const { part, index } of overviewParts(entry.overview)) {
                partIds.add(`${label}.${overviewPartId(part, index)}`);
              }
              texts.set(label, `${texts.get(label)}\n${overviewMarkdown(entry.overview)}`);
            }
          }
          if (armName === "two-pass" || shipped?.mode === "map") {
            const pick = await completeJson(
              apiKey!,
              [
                ...messages,
                shipped === null
                  ? {
                      role: "user",
                      content: `Choose the overviews whose full notes you need to answer this question: ${question.question}`,
                    }
                  : pickPrompt(question.question),
              ],
              shipped === null ? PICK_SCHEMA : PICK_SHAPE.schema,
              PICK_TOKENS,
              key,
            );
            usage = addUsage(usage, pick.usage);
            picked = [...new Set((pick.json as { overviews: string[] }).overviews.map((id) => id.split(".")[0]!))]
              .filter((label) => system.labels.has(label))
              .slice(0, PICKS);
            const whole = picked.map((label) => {
              const entry = library.overviews.get(system.labels.get(label)!)!;
              for (const { part, index } of overviewParts(entry.overview)) {
                partIds.add(`${label}.${overviewPartId(part, index)}`);
              }
              const markdown = overviewMarkdown(entry.overview, { partIds: true }).replace(
                PART_ID,
                (_, part: string) => `[${label}.${part}] `,
              );
              texts.set(label, `${texts.get(label)}\n${markdown}`);
              return `## [${label}]\n\n${markdown}`;
            });
            messages.push(
              shipped === null
                ? { role: "user", content: `The full notes of the overviews you chose:\n\n${whole.join("\n\n")}` }
                : pickedBlock(picked.map((label) => [label, library.overviews.get(system.labels.get(label)!)!.overview] as const)),
            );
          }
          messages.push({ role: "user", content: question.question });
          const reply = await completeJson(
            apiKey!,
            messages,
            shipped === null ? STRUCTURED_SCHEMA : SECTIONED_SHAPE.schema,
            shipped === null ? STRUCTURED_ANSWER_TOKENS : SECTIONED_SHAPE.maxTokens,
            key,
          );
          usage = addUsage(usage, reply.usage);
          const answer = asPoints(reply.json);
          const points = answer.sections.flatMap((section) => section.points);
          const ids = [...new Set(points.flatMap((point) => point.sources))];
          const valid = (id: string) => system.labels.has(id) || partIds.has(id);
          const cited = [...new Set(ids.filter(valid).map((id) => system.labels.get(id.split(".")[0]!)!))];
          const weakPoints = points
            .map((point) => {
              const words = [...new Set(contentWords(point.text))];
              const source = point.sources
                .filter(valid)
                .map((id) => texts.get(id.split(".")[0]!) ?? "")
                .join(" ");
              const known = new Set(contentWords(source));
              return {
                text: point.text,
                sources: point.sources,
                overlap: words.length === 0 ? 1 : words.filter((word) => known.has(word)).length / words.length,
              };
            })
            .filter((point) => point.overlap < 0.25);
          const allText = [
            answer.intro,
            ...answer.sections.flatMap((section) => [section.heading, ...section.points.map((point) => point.text)]),
            answer.takeaway,
          ].join(" ");
          turn = {
            arm: armName,
            run,
            id: question.id,
            scope: question.scope,
            failed: false,
            picked: picked.map((label) => system.labels.get(label)!),
            coreInPicks:
              armName === "two-pass" && question.core.length > 0
                ? question.core.filter((id) => picked.some((label) => system.labels.get(label) === id)).length
                : null,
            cited,
            coreFound: question.core.length === 0 ? null : question.core.filter((id) => cited.includes(id)).length,
            coreTotal: question.core.length,
            sections: answer.sections.length,
            points: points.length,
            pointsWithoutSources: points.filter((point) => point.sources.filter(valid).length === 0).length,
            pointsComparing: points.filter((point) => new Set(point.sources.filter(valid).map((id) => id.split(".")[0])).size > 1).length,
            invalidIds: ids.filter((id) => !valid(id)),
            weakPoints,
            gaveCount: COUNTED.test(allText),
            answer,
            inputTokens: usage === null ? 0 : promptTokensOf(usage),
            cachedTokens: usage?.cachedInputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            costDollars: usage === null ? 0 : costInDollars(price, usage),
            ms: Date.now() - startedAt,
          };
        } catch (error) {
          const partial = (error as { usage?: TokenUsage | null }).usage ?? null;
          usage = addUsage(usage, partial);
          turn = {
            arm: armName,
            run,
            id: question.id,
            scope: question.scope,
            failed: true,
            picked: picked.map((label) => system.labels.get(label)!),
            coreInPicks: null,
            cited: [],
            coreFound: null,
            coreTotal: question.core.length,
            sections: 0,
            points: 0,
            pointsWithoutSources: 0,
            pointsComparing: 0,
            invalidIds: [],
            weakPoints: [],
            gaveCount: false,
            answer: error instanceof Error ? error.message : String(error),
            inputTokens: usage === null ? 0 : promptTokensOf(usage),
            cachedTokens: usage?.cachedInputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            costDollars: usage === null ? 0 : costInDollars(price, usage),
            ms: Date.now() - startedAt,
          };
        }
        done.push(turn);
        spent += turn.costDollars;
        await writeFile(outPath, `${JSON.stringify(done, null, 1)}\n`);
        console.error(
          `${armName} r${run} ${question.id} ${turn.failed ? `FAILED ${String(turn.answer)}` : `$${turn.costDollars.toFixed(5)} cited ${turn.cited.length} points ${turn.points} weak ${turn.weakPoints.length}`}`,
        );
      }
    }
  }
  if (options.dryRun) {
    console.log(`dry run: ceiling about $${ceiling.toFixed(2)}`);
    return;
  }
  console.log(twoPassMarkdown(done));
  console.error(`spent $${spent.toFixed(4)} in all`);
};

const twoPassMarkdown = (turns: TwoPassTurn[]): string => {
  const arms = [...new Set(turns.map((turn) => turn.arm))];
  return [
    "| Arm | Answers | Cut off | Prompt tokens | Output tokens | Cost a question | Core found | Core in picks | Points | Without a source | Comparing 2+ | Bad ids | Weak overlap | Gave a count | Latency |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...arms.map((arm) => {
      const all = turns.filter((turn) => turn.arm === arm);
      const ok = all.filter((turn) => !turn.failed);
      const sum = (pick: (turn: TwoPassTurn) => number) => ok.reduce((total, turn) => total + pick(turn), 0);
      const core = ok.filter((turn) => turn.coreFound !== null);
      const picks = ok.filter((turn) => turn.coreInPicks !== null);
      return `| ${arm} | ${all.length} | ${all.length - ok.length} | ${median(ok.map((turn) => turn.inputTokens))} | ${median(ok.map((turn) => turn.outputTokens))} | $${median(ok.map((turn) => turn.costDollars)).toFixed(5)} | ${core.length === 0 ? "—" : `${core.reduce((t, x) => t + x.coreFound!, 0)}/${core.reduce((t, x) => t + x.coreTotal, 0)}`} | ${picks.length === 0 ? "—" : `${picks.reduce((t, x) => t + x.coreInPicks!, 0)}/${picks.reduce((t, x) => t + x.coreTotal, 0)}`} | ${sum((turn) => turn.points)} | ${sum((turn) => turn.pointsWithoutSources)} | ${sum((turn) => turn.pointsComparing)} | ${sum((turn) => turn.invalidIds.length)} | ${sum((turn) => turn.weakPoints.length)} | ${ok.filter((turn) => turn.gaveCount).length} | ${(median(ok.map((turn) => turn.ms)) / 1000).toFixed(1)} s |`;
    }),
  ].join("\n");
};

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
} else if (command === "twopass" && dataDir && rest[0]) {
  await twoPass(dataDir, rest[0], {
    arms: values.arms.split(","),
    runs: Number(values.runs),
    budget: Number(values.budget),
    dryRun: values["dry-run"],
    only: values.only ?? null,
  });
} else if (command === "project" && dataDir && rest[0]) {
  await projectChat(dataDir, rest[0], {
    arms: values.arms.split(","),
    runs: Number(values.runs),
    budget: Number(values.budget),
    dryRun: values["dry-run"],
    only: values.only ?? null,
  });
} else if (command === "keyword" && dataDir && rest[0]) {
  await keyword(dataDir, rest[0]);
} else if (command === "pgkeyword" && dataDir && rest[0]) {
  await pgKeyword(dataDir, rest[0]);
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
