import {
  CURRENT_SCHEMA_VERSIONS,
  DEFAULT_OVERVIEW_STATE,
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  changedFields,
  foldFiling,
  foldOverviewState,
  migrateStoredRecord,
  stampSchemaVersion,
  type FoldableFiling,
  type FoldableState,
  type RecordMigration,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { validateRecordBody } from "../versions/validateRecordBody.js";
import { RECORD_COLUMNS, RecordsRepository, type WriteOperation } from "./RecordsRepository.js";
import { storedRecordFromRow, type RecordRow, type StoredRecord } from "./StoredRecord.js";

export interface DuplicateFold {
  accountId: string;
  videoId: string;
  kept: string;
  folded: string[];
}

interface ReadCopy {
  record: StoredRecord;
  body: Record<string, unknown>;
}

// The one-off cleanup for accounts that came to hold two overviews of one video before the
// server refused a second: per account and video the earliest-made copy is kept, the
// others' filing and state are folded onto it, and the others are tombstoned so every
// device drops them through the feed. Runs inside the migration that puts the unique index
// on, so the index can go on (docs/features/one-overview-per-video.md).
export async function foldDuplicateOverviews(sql: SqlClient, now: () => Date = () => new Date()): Promise<DuplicateFold[]> {
  const groups = await sql.query<{ account_id: string; video_id: string }>(
    `select account_id, video_id from records
     where kind = 'overview' and not deleted and video_id is not null
     group by account_id, video_id having count(*) > 1
     order by account_id, video_id`,
  );
  const records = new RecordsRepository(sql, now);
  const folds: DuplicateFold[] = [];
  for (const { account_id, video_id } of groups) {
    folds.push(await foldOne(sql, records, account_id as AccountId, video_id, now));
  }
  return folds;
}

async function foldOne(
  sql: SqlClient,
  records: RecordsRepository,
  accountId: AccountId,
  videoId: string,
  now: () => Date,
): Promise<DuplicateFold> {
  const copies = (await records.liveOverviewsOf(accountId, videoId))
    .map((record) => readCurrent(record, OVERVIEW_MIGRATIONS, accountId, videoId))
    .sort(earliestFirst);
  const [winner, ...losers] = copies as [ReadCopy, ...ReadCopy[]];
  const states = await statesOf(sql, accountId, copies.map(({ record }) => record.id), videoId);

  const filingBefore = filingOf(winner.body);
  const filing = losers.reduce((folded, loser) => foldFiling(folded, filingOf(loser.body)), filingBefore);
  const stateBefore = states.get(winner.record.id)?.state ?? { ...DEFAULT_OVERVIEW_STATE };
  const state = losers.reduce(
    (folded, loser) => foldOverviewState(folded, states.get(loser.record.id)?.state ?? DEFAULT_OVERVIEW_STATE),
    stateBefore,
  );

  const operations: WriteOperation[] = [];
  if (Object.keys(changedFields(filingBefore, filing)).length > 0) {
    const body = { ...winner.body, ...filing };
    validateRecordBody("overview", body, CURRENT_SCHEMA_VERSIONS.overview);
    const updatedAt = latestOf(copies.map(({ record }) => record.updatedAt), now);
    operations.push({
      kind: "overview",
      id: winner.record.id,
      decide: () => ({ action: "upsert", body, schemaVersion: CURRENT_SCHEMA_VERSIONS.overview, updatedAt }),
    });
  }
  if (Object.keys(changedFields(stateBefore, state)).length > 0) {
    const body = { ...state, overviewId: winner.record.id };
    validateRecordBody("overviewState", body, CURRENT_SCHEMA_VERSIONS.overviewState);
    const updatedAt = latestOf([...states.values()].map(({ record }) => record.updatedAt), now);
    operations.push({
      kind: "overviewState",
      id: winner.record.id,
      decide: () => ({ action: "upsert", body, schemaVersion: CURRENT_SCHEMA_VERSIONS.overviewState, updatedAt }),
    });
  }
  for (const loser of losers) {
    operations.push({ kind: "overview", id: loser.record.id, decide: () => ({ action: "tombstone" }) });
    operations.push({
      kind: "overviewState",
      id: loser.record.id,
      decide: (current) => (current !== null && !current.deleted ? { action: "tombstone" } : { action: "nothing" }),
    });
  }
  await records.write(accountId, operations);

  return { accountId, videoId, kept: winner.record.id, folded: losers.map(({ record }) => record.id) };
}

// Every copy is read at the current version before anything is merged, as a field write
// is (docs/features/sync-api.md, "A merge migrates first"). One this server cannot read
// stops the fold loudly rather than guessing at it.
function readCurrent(
  record: StoredRecord,
  migrations: readonly RecordMigration[],
  accountId: string,
  videoId: string,
): ReadCopy {
  const migrated = migrateStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), migrations);
  if (migrated.status === "unreadable") {
    throw new Error(
      `${record.kind} ${record.id} in account ${accountId} cannot be read at version ${record.schemaVersion} (${migrated.detail}), so the overviews of video ${videoId} cannot be folded`,
    );
  }
  const { schemaVersion: _version, ...body } = migrated.record;
  return { record, body };
}

const savedAtOf = ({ body }: ReadCopy): string => (typeof body.savedAt === "string" ? body.savedAt : "");

const earliestFirst = (left: ReadCopy, right: ReadCopy): number =>
  savedAtOf(left).localeCompare(savedAtOf(right)) || left.record.seq - right.record.seq;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const filingOf = (body: Record<string, unknown>): FoldableFiling => ({
  topicIds: strings(body.topicIds),
  tags: strings(body.tags),
  captureReason: typeof body.captureReason === "string" ? body.captureReason : null,
});

async function statesOf(
  sql: SqlClient,
  accountId: AccountId,
  overviewIds: string[],
  videoId: string,
): Promise<Map<string, { record: StoredRecord; state: FoldableState }>> {
  const rows = await sql.query<RecordRow>(
    `select ${RECORD_COLUMNS} from records
     where account_id = $1 and kind = 'overviewState' and not deleted and id = any($2::text[])`,
    [accountId, overviewIds],
  );
  return new Map(
    rows.map(storedRecordFromRow).map((record) => {
      const { body } = readCurrent(
        { ...record, body: { ...DEFAULT_OVERVIEW_STATE, ...record.body } },
        OVERVIEW_STATE_MIGRATIONS,
        accountId,
        videoId,
      );
      return [record.id, { record, state: { read: body.read === true, favourite: body.favourite === true, userTags: strings(body.userTags) } }];
    }),
  );
}

// The latest edit among the copies dates the merged record; the fold's own clock only
// where none of them was dated (docs/features/sync-metadata.md).
function latestOf(updatedAts: Array<string | null>, now: () => Date): string {
  const dated = updatedAts.filter((at): at is string => at !== null).sort();
  return dated.at(-1) ?? now().toISOString();
}
