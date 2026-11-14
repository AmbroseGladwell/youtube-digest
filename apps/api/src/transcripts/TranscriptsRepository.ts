import type { StoredTranscript, VideoId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

const liveNoteOn = (key: string) => `select 1 from records
  where account_id = $1 and kind = 'overview' and not deleted and source_key = ${key}`;

export type Kept = "kept" | "not-noted";

// Each account's own copy of the words behind its notes, read only by that account's devices.
// Nothing is kept for every reader: a video's captions and an episode's transcript are their
// makers' work, so each reader fetches and keeps their own (docs/features/transcript-storage.md;
// OV-295, after the terms review of 13 Nov 2026).
export class TranscriptsRepository {
  #sql: SqlClient;
  #clock: () => Date;

  constructor(sql: SqlClient, clock: () => Date) {
    this.#sql = sql;
    this.#clock = clock;
  }

  async get(accountId: AccountId, videoId: VideoId): Promise<unknown> {
    const rows = await this.#sql.query<{ body: unknown }>("select body from account_transcripts where account_id = $1 and video_id = $2", [
      accountId,
      videoId,
    ]);
    return rows[0]?.body ?? null;
  }

  // Under the account's row lock, the one every note write takes to allocate its seq, so an
  // upload and a delete of its note cannot interleave (docs/features/transcript-storage.md).
  async putIfNoted(accountId: AccountId, transcript: StoredTranscript): Promise<Kept> {
    const now = this.#clock().toISOString();
    return this.#sql.transaction(async (tx) => {
      await tx.query("select id from accounts where id = $1 for update", [accountId]);
      const noted = await tx.query(liveNoteOn("$2"), [accountId, transcript.videoId]);
      if (noted.length === 0) return "not-noted";
      await tx.query(
        `insert into account_transcripts (account_id, video_id, body, stored_at)
         values ($1, $2, $3::jsonb, $4::timestamptz)
         on conflict (account_id, video_id) do update set body = excluded.body, stored_at = excluded.stored_at`,
        [accountId, transcript.videoId, JSON.stringify(transcript), now],
      );
      return "kept";
    });
  }

  async hasLiveNote(accountId: AccountId, videoId: VideoId): Promise<boolean> {
    return (await this.#sql.query(liveNoteOn("$2"), [accountId, videoId])).length > 0;
  }

  async forgetUnnoted(accountId: AccountId): Promise<number> {
    const forgotten = await this.#sql.query<{ video_id: string }>(
      `delete from account_transcripts t
       where t.account_id = $1
         and not exists (${liveNoteOn("t.video_id")})
       returning video_id`,
      [accountId],
    );
    return forgotten.length;
  }
}
