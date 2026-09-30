import { StoredTranscript, type VideoId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { outranks } from "./outranks.js";
import { shareableTranscript } from "./shareableTranscript.js";

const liveNoteOn = (videoId: string) => `select 1 from records
  where account_id = $1 and kind = 'overview' and not deleted and body -> 'video' ->> 'id' = ${videoId}`;

export type Contribution = "added" | "upgraded" | "kept" | "not-noted";

// One shared copy per video, and a link from each account whose notes use it. Outside the
// records feed: a transcript is large, never edited and re-creatable
// (docs/features/transcript-storage.md, docs/features/shared-transcript-cache.md).
export class TranscriptsRepository {
  #sql: SqlClient;
  #clock: () => Date;

  constructor(sql: SqlClient, clock: () => Date) {
    this.#sql = sql;
    this.#clock = clock;
  }

  async get(accountId: AccountId, videoId: VideoId): Promise<unknown> {
    const rows = await this.#sql.query<{ body: unknown }>(
      `select s.body from account_transcripts a join shared_transcripts s using (video_id)
       where a.account_id = $1 and a.video_id = $2`,
      [accountId, videoId],
    );
    return rows[0]?.body ?? null;
  }

  async getShared(videoId: VideoId): Promise<unknown> {
    const rows = await this.#sql.query<{ body: unknown }>("select body from shared_transcripts where video_id = $1", [
      videoId,
    ]);
    return rows[0]?.body ?? null;
  }

  // Under the account's row lock, the one every note write takes to allocate its seq, so an
  // upload and a delete of its note cannot interleave (docs/features/transcript-storage.md).
  async putIfNoted(accountId: AccountId, transcript: StoredTranscript): Promise<Contribution> {
    const now = this.#clock().toISOString();
    const shared = JSON.stringify(shareableTranscript(transcript));
    return this.#sql.transaction(async (tx) => {
      await tx.query("select id from accounts where id = $1 for update", [accountId]);
      const noted = await tx.query(liveNoteOn("$2"), [accountId, transcript.videoId]);
      if (noted.length === 0) return "not-noted";

      const inserted = await tx.query(
        `insert into shared_transcripts (video_id, body, contributed_by, contributed_at)
         values ($1, $2::jsonb, $3, $4::timestamptz)
         on conflict (video_id) do nothing
         returning video_id`,
        [transcript.videoId, shared, accountId, now],
      );
      let contribution: Contribution = "added";
      if (inserted.length === 0) {
        const [held] = await tx.query<{ body: unknown }>(
          "select body from shared_transcripts where video_id = $1 for update",
          [transcript.videoId],
        );
        const heldTranscript = StoredTranscript.safeParse(held?.body);
        contribution = !heldTranscript.success || outranks(transcript, heldTranscript.data) ? "upgraded" : "kept";
        if (contribution === "upgraded") {
          await tx.query(
            `update shared_transcripts set body = $2::jsonb, contributed_by = $3, contributed_at = $4::timestamptz
             where video_id = $1`,
            [transcript.videoId, shared, accountId, now],
          );
        }
      }

      await tx.query(
        `insert into account_transcripts (account_id, video_id, stored_at) values ($1, $2, $3::timestamptz)
         on conflict (account_id, video_id) do update set stored_at = excluded.stored_at`,
        [accountId, transcript.videoId, now],
      );
      return contribution;
    });
  }

  async forgetUnnoted(accountId: AccountId): Promise<void> {
    await this.#sql.query(
      `delete from account_transcripts t
       where t.account_id = $1
         and not exists (${liveNoteOn("t.video_id")})`,
      [accountId],
    );
  }

  async contributorOf(videoId: VideoId): Promise<AccountId | null> {
    const rows = await this.#sql.query<{ contributed_by: AccountId | null }>(
      "select contributed_by from shared_transcripts where video_id = $1",
      [videoId],
    );
    return rows[0]?.contributed_by ?? null;
  }

  // Every account linked to a forgotten copy loses its link with it, and its next upload of
  // that video contributes afresh (docs/features/shared-transcript-cache.md, "Removing one").
  async forgetShared(videoId: VideoId): Promise<number> {
    const rows = await this.#sql.query("delete from shared_transcripts where video_id = $1 returning video_id", [videoId]);
    return rows.length;
  }

  async forgetContributionsOf(accountId: AccountId): Promise<number> {
    const rows = await this.#sql.query("delete from shared_transcripts where contributed_by = $1 returning video_id", [
      accountId,
    ]);
    return rows.length;
  }
}
