import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

// For the chat harnesses, read only: docs/architecture/in-app-chat.md, "Running it again".

const [email, outDir] = process.argv.slice(2);
const databaseUrl = process.env["DATABASE_URL"];
if (!email || !outDir || !databaseUrl) {
  console.error("usage: DATABASE_URL=… node dist/scripts/exportChatLibrary.js <email> <out dir>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, options: "-c default_transaction_read_only=on", max: 1 });
const query = async <T extends pg.QueryResultRow>(text: string, values: unknown[]): Promise<T[]> =>
  (await pool.query<T>(text, values)).rows;

try {
  const [readOnly] = await query<{ transaction_read_only: string }>("show transaction_read_only", []);
  if (readOnly?.transaction_read_only !== "on") {
    throw new Error("the connection is not read only");
  }

  const [account] = await query<{ id: string }>("select id from accounts where email = $1", [email.trim().toLowerCase()]);
  if (account === undefined) {
    throw new Error("no account for that email");
  }

  const overviews = await query<{ id: string; rev: number; schema_version: number; stored_at: Date; body: unknown }>(
    `select id, rev, schema_version, stored_at, body from records
      where account_id = $1 and kind = 'overview' and not deleted order by stored_at`,
    [account.id],
  );
  const embedded = await query<{ overview_id: string; embedded_rev: number; model: string; tokens: number }>(
    `select e.overview_id, e.embedded_rev, e.model, e.tokens from overview_embeddings e
       join records r on r.account_id = e.account_id and r.kind = 'overview' and r.id = e.overview_id
                     and not r.deleted and r.rev = e.embedded_rev
      where e.account_id = $1`,
    [account.id],
  );
  const claims = await query<{ overview_id: string; position: number; text_hash: string; model: string; embedding: string }>(
    `select overview_id, position, text_hash, model, embedding::text as embedding from claim_embeddings
      where account_id = $1 order by overview_id, position`,
    [account.id],
  );
  const transcripts = await query<{ video_id: string; body: unknown }>(
    "select video_id, body from account_transcripts where account_id = $1",
    [account.id],
  );

  const projects = await query<{ kind: string; id: string; schema_version: number; body: unknown }>(
    `select kind, id, schema_version, body from records
      where account_id = $1 and kind in ('project', 'projectMember', 'overviewState', 'topic') and not deleted`,
    [account.id],
  );

  const current = new Set(embedded.map((row) => row.overview_id));
  await mkdir(join(outDir, "transcripts"), { recursive: true });
  await writeFile(
    join(outDir, "library.json"),
    `${JSON.stringify({
      exportedAt: new Date().toISOString(),
      overviews: overviews.map((row) => ({
        id: row.id,
        rev: row.rev,
        schemaVersion: row.schema_version,
        storedAt: row.stored_at,
        body: row.body,
      })),
      embeddings: embedded.map((row) => ({
        overviewId: row.overview_id,
        embeddedRev: row.embedded_rev,
        model: row.model,
        tokens: row.tokens,
        claims: claims
          .filter((claim) => claim.overview_id === row.overview_id)
          .map((claim) => ({ position: claim.position, textHash: claim.text_hash, model: claim.model, embedding: claim.embedding })),
      })),
      projects: projects
        .filter((row) => row.kind === "project")
        .map((row) => ({ id: row.id, schemaVersion: row.schema_version, body: row.body })),
      projectMembers: projects
        .filter((row) => row.kind === "projectMember")
        .map((row) => ({ id: row.id, schemaVersion: row.schema_version, body: row.body })),
      overviewStates: projects
        .filter((row) => row.kind === "overviewState")
        .map((row) => ({ id: row.id, schemaVersion: row.schema_version, body: row.body })),
      topics: projects
        .filter((row) => row.kind === "topic")
        .map((row) => ({ id: row.id, schemaVersion: row.schema_version, body: row.body })),
    })}\n`,
  );
  for (const transcript of transcripts) {
    await writeFile(join(outDir, "transcripts", `${encodeURIComponent(transcript.video_id)}.json`), `${JSON.stringify(transcript.body)}\n`);
  }
  console.error(
    `${overviews.length} live overviews, ${current.size} embedded at their current rev (${claims.filter((claim) => current.has(claim.overview_id)).length} claims), ${transcripts.length} transcripts, ${projects.filter((row) => row.kind === "project").length} projects, ${projects.filter((row) => row.kind === "overviewState").length} overview states, ${projects.filter((row) => row.kind === "topic").length} topics → ${outDir}`,
  );
} finally {
  await pool.end();
}
