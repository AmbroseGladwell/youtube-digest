import type { StoredTranscript, TranscriptionFailure } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { usageMonth } from "../usage/usageMonth.js";

export type TranscriptionStatus = "queued" | "waiting" | "transcribing" | "ready" | "failed";

export interface PodcastTranscriptionJob {
  id: string;
  caller: string;
  sourceKey: string;
  audioUrl: string;
  maxSeconds: number;
  reservedSeconds: number;
  status: TranscriptionStatus;
  hostCallId: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  transcript: StoredTranscript | null;
  failure: TranscriptionFailure | null;
}

interface JobRow {
  id: string;
  caller: string;
  source_key: string;
  audio_url: string;
  max_seconds: number;
  reserved_seconds: number;
  status: TranscriptionStatus;
  host_call_id: string | null;
  requested_at: Date | string;
  started_at: Date | string | null;
  transcript: StoredTranscript | null;
  failure: TranscriptionFailure | null;
}

const COLUMNS =
  "id, caller, source_key, audio_url, max_seconds, reserved_seconds, status, host_call_id, requested_at, started_at, transcript, failure";

const fromRow = (row: JobRow): PodcastTranscriptionJob => ({
  id: row.id,
  caller: row.caller,
  sourceKey: row.source_key,
  audioUrl: row.audio_url,
  maxSeconds: row.max_seconds,
  reservedSeconds: row.reserved_seconds,
  status: row.status,
  hostCallId: row.host_call_id,
  requestedAt: new Date(row.requested_at),
  startedAt: row.started_at === null ? null : new Date(row.started_at),
  transcript: row.transcript,
  failure: row.failure,
});

export interface TranscriptionAsk {
  id: string;
  caller: string;
  accountId: AccountId | null;
  sourceKey: string;
  audioUrl: string;
  maxSeconds: number;
  reserveSeconds: number;
  limitSeconds: number;
  now: Date;
}

export type TranscriptionAsked =
  | { outcome: "queued"; job: PodcastTranscriptionJob }
  | { outcome: "existing"; job: PodcastTranscriptionJob }
  | { outcome: "over-allowance"; usedSeconds: number };

export interface TranscriptionUsage {
  usedSeconds: number;
  episodes: number;
}

// A caller's transcriptions and the month's seconds they hold: one job per caller and episode,
// so asking again for words already made or on their way costs nothing, and a failed one starts
// again from nothing (docs/features/speech-to-text.md, "The server rung").
export class PodcastTranscriptionsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async get(id: string, caller: string): Promise<PodcastTranscriptionJob | null> {
    const rows = await this.#sql.query<JobRow>(`select ${COLUMNS} from podcast_transcriptions where id = $1 and caller = $2`, [id, caller]);
    return rows[0] === undefined ? null : fromRow(rows[0]);
  }

  async usedSeconds(now: Date, caller: string): Promise<number> {
    return (await this.usage(now, caller)).usedSeconds;
  }

  // The month's seconds held or spent, and the episodes they went on.
  async usage(now: Date, caller: string): Promise<TranscriptionUsage> {
    const rows = await this.#sql.query<{ seconds: number; episodes: number }>(
      "select seconds, episodes from transcription_usage where month = $1::date and caller = $2",
      [usageMonth(now), caller],
    );
    return { usedSeconds: rows[0]?.seconds ?? 0, episodes: rows[0]?.episodes ?? 0 };
  }

  // Where a caller's transcription of an episode stands, while it is kept.
  async find(caller: string, sourceKey: string): Promise<TranscriptionStatus | null> {
    const rows = await this.#sql.query<{ status: TranscriptionStatus }>(
      "select status from podcast_transcriptions where caller = $1 and source_key = $2",
      [caller, sourceKey],
    );
    return rows[0]?.status ?? null;
  }

  async request(ask: TranscriptionAsk): Promise<TranscriptionAsked> {
    // A trial's hashed address is counted for its month and no longer.
    await this.#sql.query("delete from transcription_usage where account_id is null and month < $1::date", [usageMonth(ask.now)]);
    return this.#sql.transaction(async (tx) => {
      const existing = await tx.query<JobRow>(
        `select ${COLUMNS} from podcast_transcriptions where caller = $1 and source_key = $2 for update`,
        [ask.caller, ask.sourceKey],
      );
      if (existing[0] !== undefined && existing[0].status !== "failed") {
        return { outcome: "existing", job: fromRow(existing[0]) };
      }
      const held = await tx.query(
        `insert into transcription_usage (month, caller, account_id, seconds) values ($1::date, $2, $3, $4)
         on conflict (month, caller) do update set seconds = transcription_usage.seconds + excluded.seconds
         where transcription_usage.seconds + excluded.seconds <= $5
         returning seconds`,
        [usageMonth(ask.now), ask.caller, ask.accountId, ask.reserveSeconds, ask.limitSeconds],
      );
      if (held.length === 0 || ask.reserveSeconds > ask.limitSeconds) {
        if (held.length > 0) {
          await this.#give(tx, ask.now, ask.caller, ask.reserveSeconds);
        }
        return { outcome: "over-allowance", usedSeconds: await this.#usedIn(tx, ask.now, ask.caller) };
      }
      const rows = await tx.query<JobRow>(
        `insert into podcast_transcriptions
           (id, caller, account_id, source_key, audio_url, max_seconds, reserved_seconds, status, requested_at)
         values ($1, $2, $3, $4, $5, $6, $7, 'queued', $8::timestamptz)
         on conflict (caller, source_key) do update set
           id = excluded.id, audio_url = excluded.audio_url, max_seconds = excluded.max_seconds,
           reserved_seconds = excluded.reserved_seconds, status = 'queued', host_call_id = null,
           requested_at = excluded.requested_at, claimed_until = null, started_at = null, finished_at = null,
           transcript = null, failure = null
         returning ${COLUMNS}`,
        [ask.id, ask.caller, ask.accountId, ask.sourceKey, ask.audioUrl, ask.maxSeconds, ask.reserveSeconds, ask.now.toISOString()],
      );
      return { outcome: "queued", job: fromRow(rows[0]!) };
    });
  }

  // The oldest unfinished job no worker holds. A queued job is held from its claim, before it
  // reaches the host, so workers asking at once can't each send it. One whose worker went quiet
  // past its lease is picked up where it was, its call to the host included. Finished jobs past
  // keepUntil go, and their words with them.
  async claimNext(now: Date, leaseUntil: Date, finishedBefore: Date): Promise<PodcastTranscriptionJob | null> {
    await this.#sql.query("delete from podcast_transcriptions where status in ('ready', 'failed') and finished_at < $1::timestamptz", [
      finishedBefore.toISOString(),
    ]);
    const rows = await this.#sql.query<JobRow>(
      `update podcast_transcriptions set claimed_until = $2::timestamptz
       where id = (
         select id from podcast_transcriptions
         where status in ('queued', 'waiting', 'transcribing')
           and (claimed_until is null or claimed_until < $1::timestamptz)
         order by requested_at
         limit 1
         for update skip locked
       )
       returning ${COLUMNS}`,
      [now.toISOString(), leaseUntil.toISOString()],
    );
    return rows[0] === undefined ? null : fromRow(rows[0]);
  }

  async markSubmitted(id: string, hostCallId: string, leaseUntil: Date): Promise<void> {
    await this.#sql.query(
      "update podcast_transcriptions set status = 'waiting', host_call_id = $2, claimed_until = $3::timestamptz where id = $1",
      [id, hostCallId, leaseUntil.toISOString()],
    );
  }

  async markStarted(id: string, now: Date, leaseUntil: Date): Promise<void> {
    await this.#sql.query(
      "update podcast_transcriptions set status = 'transcribing', started_at = $2::timestamptz, claimed_until = $3::timestamptz where id = $1",
      [id, now.toISOString(), leaseUntil.toISOString()],
    );
  }

  async renew(id: string, leaseUntil: Date): Promise<void> {
    await this.#sql.query("update podcast_transcriptions set claimed_until = $2::timestamptz where id = $1", [
      id,
      leaseUntil.toISOString(),
    ]);
  }

  // The words, the month's held seconds settled to what the audio measured, and one more episode.
  // Only the first to finish a job settles it, so a job run twice is still counted once.
  async markReady(job: PodcastTranscriptionJob, transcript: StoredTranscript, audioSeconds: number, now: Date): Promise<boolean> {
    const measured = Math.ceil(audioSeconds);
    return this.#sql.transaction(async (tx) => {
      const settled = await tx.query(
        `update podcast_transcriptions set status = 'ready', transcript = $2::jsonb, reserved_seconds = $3,
           finished_at = $4::timestamptz, claimed_until = null
         where id = $1 and status in ('queued', 'waiting', 'transcribing')
         returning id`,
        [job.id, JSON.stringify(transcript), measured, now.toISOString()],
      );
      if (settled.length === 0) {
        return false;
      }
      await this.#give(tx, job.requestedAt, job.caller, job.reservedSeconds - measured);
      await tx.query("update transcription_usage set episodes = episodes + 1 where month = $1::date and caller = $2", [
        usageMonth(job.requestedAt),
        job.caller,
      ]);
      return true;
    });
  }

  // A transcription that made no words costs the caller nothing.
  async markFailed(job: PodcastTranscriptionJob, failure: TranscriptionFailure, now: Date): Promise<boolean> {
    return this.#sql.transaction(async (tx) => {
      const settled = await tx.query(
        `update podcast_transcriptions set status = 'failed', failure = $2, reserved_seconds = 0,
           finished_at = $3::timestamptz, claimed_until = null
         where id = $1 and status in ('queued', 'waiting', 'transcribing')
         returning id`,
        [job.id, failure, now.toISOString()],
      );
      if (settled.length === 0) {
        return false;
      }
      await this.#give(tx, job.requestedAt, job.caller, job.reservedSeconds);
      return true;
    });
  }

  async #give(tx: SqlClient, at: Date, caller: string, seconds: number): Promise<void> {
    if (seconds === 0) {
      return;
    }
    await tx.query("update transcription_usage set seconds = greatest(seconds - $3, 0) where month = $1::date and caller = $2", [
      usageMonth(at),
      caller,
      seconds,
    ]);
  }

  async #usedIn(tx: SqlClient, now: Date, caller: string): Promise<number> {
    const rows = await tx.query<{ seconds: number }>("select seconds from transcription_usage where month = $1::date and caller = $2", [
      usageMonth(now),
      caller,
    ]);
    return rows[0]?.seconds ?? 0;
  }
}
