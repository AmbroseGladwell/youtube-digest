import type { StoredTranscript, VideoId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { TranscriptPassagesRepository } from "./TranscriptPassagesRepository.js";

const liveNoteOn = (key: string) => `select 1 from records
  where account_id = $1 and not deleted and source_key = ${key}
    and (kind = 'overview' or (kind = 'capture' and body ->> 'stage' = 'saved'))`;

export type Kept = "kept" | "not-noted";

// Own copies: docs/features/transcript-storage.md, "Following the reader across devices".
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

  // Takes the account row lock every note write takes, so an upload can't interleave with its note's delete.
  async putIfNoted(accountId: AccountId, transcript: StoredTranscript): Promise<Kept> {
    const now = this.#clock().toISOString();
    return this.#sql.transaction(async (tx) => {
      await tx.query("select id from accounts where id = $1 for update", [accountId]);
      const noted = await tx.query(liveNoteOn("$2"), [accountId, transcript.videoId]);
      if (noted.length === 0) {
        return "not-noted";
      }
      await tx.query(
        `insert into account_transcripts (account_id, video_id, body, stored_at)
         values ($1, $2, $3::jsonb, $4::timestamptz)
         on conflict (account_id, video_id) do update set body = excluded.body, stored_at = excluded.stored_at`,
        [accountId, transcript.videoId, JSON.stringify(transcript), now],
      );
      await TranscriptPassagesRepository.index(tx, accountId, transcript.videoId, transcript);
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
