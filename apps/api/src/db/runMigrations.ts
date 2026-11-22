import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { SqlClient } from "./SqlClient.js";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);
const MIGRATION_FILE = /^V(\d{4})__([a-z0-9_]+)\.sql$/;
const MIGRATIONS_LOCK = 8_631_004;

export interface AppliedMigration {
  version: number;
  name: string;
}

export type MigrationSteps = Partial<Record<number, (tx: SqlClient) => Promise<void>>>;

export interface RunMigrationsOptions {
  dir?: URL;
  before?: MigrationSteps;
  upTo?: number;
}

export interface MigrationFile {
  file: string;
  match: RegExpExecArray;
}

// Flyway's naming without Flyway: docs/architecture/api.md, "Configuration and running".
export const runMigrations = async (
  sql: SqlClient,
  { dir = MIGRATIONS_DIR, before = {}, upTo = Number.POSITIVE_INFINITY }: RunMigrationsOptions = {},
): Promise<AppliedMigration[]> => {
  await sql.execute(
    "create table if not exists schema_migrations (version integer primary key, name text not null, applied_at timestamptz not null default now())",
  );
  const files = (await readdir(fileURLToPath(dir)))
    .map((file) => ({ file, match: MIGRATION_FILE.exec(file) }))
    .filter((entry): entry is MigrationFile => entry.match !== null)
    .map(({ file, match }) => ({ file, version: Number(match[1]), name: match[2]! }))
    .filter(({ version }) => version <= upTo)
    .sort((a, b) => a.version - b.version);
  const clash = files.find((entry, index) => index > 0 && files[index - 1]!.version === entry.version);
  if (clash !== undefined) {
    throw new Error(`two migrations share version ${clash.version}, so one of them would never run`);
  }

  const applied: AppliedMigration[] = [];
  for (const { file, version, name } of files) {
    const ran = await sql.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock($1)", [MIGRATIONS_LOCK]);
      const existing = await tx.query<{ version: number }>("select version from schema_migrations where version = $1", [version]);
      if (existing.length > 0) {
        return false;
      }
      await before[version]?.(tx);
      await tx.execute(await readFile(new URL(file, dir), "utf8"));
      await tx.query("insert into schema_migrations (version, name) values ($1, $2)", [version, name]);
      return true;
    });
    if (ran) {
      applied.push({ version, name });
    }
  }
  return applied;
};
