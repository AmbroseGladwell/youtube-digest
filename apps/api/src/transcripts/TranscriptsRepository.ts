import type { StoredTranscript, VideoId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { shareableTranscript } from "./shareableTranscript.js";
import { wordsHash } from "./wordsHash.js";

const liveNoteOn = (videoId: string) => `select 1 from records
  where account_id = $1 and kind = 'overview' and not deleted and body -> 'video' ->> 'id' = ${videoId}`;

const ACCOUNTS_TO_CONFIRM = 2;
const CONTRIBUTION_RETENTION_DAYS = 365;

export type Contribution = "pending" | "confirmed" | "already-confirmed" | "not-noted";

// Each distinct copy of a video's words, served only once two accounts have fetched it
// themselves; each account's link to the copy it sent; and who sent what, kept apart from
// both (docs/features/shared-transcript-cache.md).
export class TranscriptsRepository {
  #sql: SqlClient;
  #clock: () => Date;

  constructor(sql: SqlClient, clock: () => Date) {
    this.#sql = sql;
    this.#clock = clock;
  }

  async get(accountId: AccountId, videoId: VideoId): Promise<unknown> {
    const rows = await this.#sql.query<{ body: unknown }>(
      `select s.body from account_transcripts a join shared_transcripts s using (video_id, words_hash)
       where a.account_id = $1 and a.video_id = $2`,
      [accountId, videoId],
    );
    return rows[0]?.body ?? null;
  }

  async getShared(videoId: VideoId): Promise<unknown> {
    const rows = await this.#sql.query<{ body: unknown }>(
      `select body from shared_transcripts
       where video_id = $1 and confirmed_at is not null
       order by (body ->> 'generated')::boolean, confirmed_at
       limit 1`,
      [videoId],
    );
    return rows[0]?.body ?? null;
  }

  // Under the account's row lock, the one every note write takes to allocate its seq, so an
  // upload and a delete of its note cannot interleave (docs/features/transcript-storage.md).
  async putIfNoted(accountId: AccountId, transcript: StoredTranscript): Promise<Contribution> {
    const now = this.#clock();
    const hash = wordsHash(transcript);
    const { videoId } = transcript;
    return this.#sql.transaction(async (tx) => {
      await tx.query("select id from accounts where id = $1 for update", [accountId]);
      const noted = await tx.query(liveNoteOn("$2"), [accountId, videoId]);
      if (noted.length === 0) return "not-noted";

      await tx.query(
        `insert into shared_transcripts (video_id, words_hash, body, stored_at)
         values ($1, $2, $3::jsonb, $4::timestamptz)
         on conflict (video_id, words_hash) do update set body = excluded.body
         where shared_transcripts.body -> 'video' is null and excluded.body -> 'video' is not null`,
        [videoId, hash, JSON.stringify(shareableTranscript(transcript)), now.toISOString()],
      );
      await tx.query(
        `insert into transcript_contributions (video_id, account_id, words_hash, contributed_at)
         values ($1, $2, $3, $4::timestamptz)
         on conflict (video_id, account_id) do update set
           words_hash = excluded.words_hash, contributed_at = excluded.contributed_at`,
        [videoId, accountId, hash, now.toISOString()],
      );
      await tx.query(
        `insert into account_transcripts (account_id, video_id, words_hash, stored_at)
         values ($1, $2, $3, $4::timestamptz)
         on conflict (account_id, video_id) do update set
           words_hash = excluded.words_hash, stored_at = excluded.stored_at`,
        [accountId, videoId, hash, now.toISOString()],
      );
      await this.#forgetUnlinkedPending(tx, videoId);
      await tx.query("delete from transcript_contributions where contributed_at < $1::timestamptz", [
        new Date(now.getTime() - CONTRIBUTION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      ]);

      const [copy] = await tx.query<{ confirmed_at: unknown }>(
        "select confirmed_at from shared_transcripts where video_id = $1 and words_hash = $2 for update",
        [videoId, hash],
      );
      if (copy?.confirmed_at != null) return "already-confirmed";
      const confirmed = await tx.query(
        `update shared_transcripts set confirmed_at = $3::timestamptz
         where video_id = $1 and words_hash = $2
           and (select count(*) from transcript_contributions where video_id = $1 and words_hash = $2) >= $4
         returning video_id`,
        [videoId, hash, now.toISOString(), ACCOUNTS_TO_CONFIRM],
      );
      return confirmed.length === 0 ? "pending" : "confirmed";
    });
  }

  // Our own fetch needs no second account to agree with it: nobody but us touched it
  // (docs/architecture/server-side-transcripts.md).
  async putServiceFetched(transcript: StoredTranscript): Promise<void> {
    const now = this.#clock().toISOString();
    await this.#sql.query(
      `insert into shared_transcripts (video_id, words_hash, body, stored_at, confirmed_at)
       values ($1, $2, $3::jsonb, $4::timestamptz, $4::timestamptz)
       on conflict (video_id, words_hash) do update set
         confirmed_at = coalesce(shared_transcripts.confirmed_at, excluded.confirmed_at),
         body = case when shared_transcripts.body -> 'video' is null then excluded.body else shared_transcripts.body end`,
      [transcript.videoId, wordsHash(transcript), JSON.stringify(shareableTranscript(transcript)), now],
    );
  }

  async forgetUnnoted(accountId: AccountId): Promise<number> {
    return this.#sql.transaction(async (tx) => {
      const forgotten = await tx.query<{ video_id: string }>(
        `delete from account_transcripts t
         where t.account_id = $1
           and not exists (${liveNoteOn("t.video_id")})
         returning video_id`,
        [accountId],
      );
      for (const { video_id } of forgotten) {
        await this.#forgetUnlinkedPending(tx, video_id);
      }
      return forgotten.length;
    });
  }

  // A copy nobody has confirmed is only ever read by the accounts linked to it, so once none
  // are, it is kept nowhere. Their contributions stay: a later matching fetch still counts them.
  async #forgetUnlinkedPending(tx: SqlClient, videoId: string): Promise<void> {
    await tx.query(
      `delete from shared_transcripts s
       where s.video_id = $1 and s.confirmed_at is null
         and not exists (select 1 from account_transcripts a where a.video_id = s.video_id and a.words_hash = s.words_hash)`,
      [videoId],
    );
  }

  async vouchersFor(videoId: VideoId): Promise<AccountId[]> {
    const rows = await this.#sql.query<{ account_id: AccountId }>(
      `select c.account_id from transcript_contributions c
       join shared_transcripts s using (video_id, words_hash)
       where c.video_id = $1 and s.confirmed_at is not null`,
      [videoId],
    );
    return rows.map((row) => row.account_id);
  }

  // Every account linked to a forgotten copy loses its link with it, and its next upload of
  // that video contributes afresh (docs/features/shared-transcript-cache.md, "Removing one").
  async forgetShared(videoId: VideoId): Promise<number> {
    return this.#sql.transaction(async (tx) => {
      await tx.query("delete from transcript_contributions where video_id = $1", [videoId]);
      const rows = await tx.query("delete from shared_transcripts where video_id = $1 returning video_id", [videoId]);
      return rows.length;
    });
  }

  async forgetContributionsOf(accountIds: AccountId[]): Promise<number> {
    return this.#sql.transaction(async (tx) => {
      const contributed = await tx.query<{ video_id: string; words_hash: string }>(
        "delete from transcript_contributions where account_id = any($1::uuid[]) returning video_id, words_hash",
        [accountIds],
      );
      let forgotten = 0;
      for (const { video_id, words_hash } of contributed) {
        await tx.query("delete from transcript_contributions where video_id = $1 and words_hash = $2", [video_id, words_hash]);
        const rows = await tx.query(
          "delete from shared_transcripts where video_id = $1 and words_hash = $2 returning video_id",
          [video_id, words_hash],
        );
        forgotten += rows.length;
      }
      return forgotten;
    });
  }
}
