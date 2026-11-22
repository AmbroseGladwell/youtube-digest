import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { Chat, CHAT_MIGRATIONS, Overview, OVERVIEW_MIGRATIONS, readStoredRecord, sourceKey, stampSchemaVersion } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ClaimEmbeddingsRepository } from "../meaning/ClaimEmbeddingsRepository.js";
import { createOpenAiEmbedder, EMBEDDING_MODEL } from "../meaning/createOpenAiEmbedder.js";
import { TranscriptPassagesRepository } from "../transcripts/TranscriptPassagesRepository.js";

// OV-362: how close is what Found for you adds, for the questions one reader really asked? Lists,
// for each question in their overview chats, the closest overviews by meaning with their similarity
// and the overviews the keyword minutes come from with their best score, so the floors that keep
// unrelated overviews out can be read off real questions. Three steps, so production is only ever
// read, and only the evals key embeds:
//
//   DATABASE_URL=… node dist/scripts/foundRelevanceCheck.js questions <email> <questions.json>   # overview-prod, read only
//   OPENAI_API_KEY=… node dist/scripts/foundRelevanceCheck.js embed <questions.json>             # overview-evals
//   DATABASE_URL=… node dist/scripts/foundRelevanceCheck.js score <questions.json> <out.json>     # overview-prod, read only

interface Asked {
  accountId: string;
  chatId: string;
  home: string;
  homeTitle: string;
  question: string;
  found: string[];
  vector?: number[];
}

const [mode, ...rest] = process.argv.slice(2);

const readOnlyPool = () => {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is needed");
  }
  return new pg.Pool({ connectionString: url, options: "-c default_transaction_read_only=on", max: 1 });
};

const sqlOf = (pool: pg.Pool): SqlClient => ({
  query: async <Row>(text: string, params: unknown[] = []) => (await pool.query(text, params)).rows as Row[],
  execute: async () => {
    throw new Error("read only");
  },
  transaction: async () => {
    throw new Error("read only");
  },
  close: () => pool.end(),
});

const assertReadOnly = async (sql: SqlClient) => {
  const [row] = await sql.query<{ transaction_read_only: string }>("show transaction_read_only");
  if (row?.transaction_read_only !== "on") {
    throw new Error("the connection is not read only");
  }
};

const overviewsOf = async (sql: SqlClient, accountId: string) => {
  const rows = await sql.query<{ id: string; schema_version: number; body: unknown }>(
    "select id, schema_version, body from records where account_id = $1 and kind = 'overview' and not deleted",
    [accountId],
  );
  const byId = new Map<string, Overview>();
  for (const row of rows) {
    const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schema_version), Overview, OVERVIEW_MIGRATIONS);
    if (read.status === "read") {
      byId.set(row.id, read.record);
    }
  }
  return byId;
};

const questions = async (email: string, out: string) => {
  const sql = sqlOf(readOnlyPool());
  try {
    await assertReadOnly(sql);
    const [account] = await sql.query<{ id: string }>("select id from accounts where email = $1", [email.trim().toLowerCase()]);
    if (account === undefined) {
      throw new Error("no account for that email");
    }
    const overviews = await overviewsOf(sql, account.id);
    const rows = await sql.query<{ id: string; schema_version: number; body: unknown }>(
      "select id, schema_version, body from records where account_id = $1 and kind = 'chat' and not deleted",
      [account.id],
    );
    const asked: Asked[] = [];
    for (const row of rows) {
      const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schema_version), Chat, CHAT_MIGRATIONS);
      if (read.status !== "read" || read.record.overviewId === undefined) {
        continue;
      }
      const home = read.record.overviewId;
      for (const message of read.record.messages.filter((each) => each.from === "reader")) {
        asked.push({
          accountId: account.id,
          chatId: row.id,
          home,
          homeTitle: overviews.get(home)?.source.title ?? "(deleted)",
          question: message.text,
          found: (message.sources ?? []).filter((source) => source.how === "found").map((source) => source.title),
        });
      }
    }
    await writeFile(out, JSON.stringify(asked, null, 1));
    console.log(`${asked.length} questions`);
  } finally {
    await sql.close();
  }
};

const embed = async (file: string) => {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is needed");
  }
  const asked = JSON.parse(await readFile(file, "utf8")) as Asked[];
  const embedded = await createOpenAiEmbedder({ apiKey, http: fetch }).embed(asked.map((each) => each.question.trim().toLowerCase()));
  asked.forEach((each, index) => {
    const vector = embedded.vectors[index];
    if (vector !== undefined) {
      each.vector = vector;
    }
  });
  await writeFile(file, JSON.stringify(asked));
  console.log(`${embedded.tokens} tokens embedded`);
};

const score = async (file: string, out: string) => {
  const asked = JSON.parse(await readFile(file, "utf8")) as Asked[];
  const sql = sqlOf(readOnlyPool());
  try {
    await assertReadOnly(sql);
    const claims = new ClaimEmbeddingsRepository(sql);
    const passages = new TranscriptPassagesRepository(sql);
    const titles = new Map<string, Map<string, Overview>>();
    const results = [];
    for (const each of asked) {
      if (each.vector === undefined) {
        continue;
      }
      const overviews = titles.get(each.accountId) ?? (await overviewsOf(sql, each.accountId));
      titles.set(each.accountId, overviews);
      const home = overviews.get(each.home);
      const homeKey = home === undefined ? null : sourceKey(home.source);
      const byMeaning = (await claims.closest(each.accountId as AccountId, each.vector, EMBEDDING_MODEL, 10, null))
        .filter((match) => match.overviewId !== each.home)
        .slice(0, 6)
        .map((match) => ({
          title: overviews.get(match.overviewId)?.source.title ?? match.overviewId,
          similarity: Number(match.similarity.toFixed(3)),
        }));
      const hits = await passages.search(each.accountId as AccountId, each.question, {
        limit: 8,
        except: homeKey === null ? [] : [homeKey as never],
      });
      const keyOf = new Map<string, string>(
        [...overviews.values()].map((overview) => [String(sourceKey(overview.source)), overview.source.title]),
      );
      const best = new Map<string, number>();
      for (const hit of hits) {
        best.set(hit.videoId, Math.max(best.get(hit.videoId) ?? 0, hit.score));
      }
      const byWords = [...best].map(([videoId, value]) => ({ title: keyOf.get(videoId) ?? videoId, score: Number(value.toFixed(3)) }));
      results.push({ question: each.question, home: each.homeTitle, storedFound: each.found, byMeaning, byWords });
    }
    await writeFile(out, JSON.stringify(results, null, 1));
    console.log(`${results.length} questions scored`);
  } finally {
    await sql.close();
  }
};

if (mode === "questions" && rest.length === 2) {
  await questions(rest[0]!, rest[1]!);
} else if (mode === "embed" && rest.length === 1) {
  await embed(rest[0]!);
} else if (mode === "score" && rest.length === 2) {
  await score(rest[0]!, rest[1]!);
} else {
  console.error(
    "usage: foundRelevanceCheck.js questions <email> <questions.json> | embed <questions.json> | score <questions.json> <out.json>",
  );
  process.exit(1);
}
