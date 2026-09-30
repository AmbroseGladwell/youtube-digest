import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

export type AudioPriority = "interactive" | "background";
export type AudioRenderStatus = "queued" | "rendering" | "ready" | "failed";

const PRIORITY_RANK: Record<AudioPriority, number> = { interactive: 0, background: 1 };
const PRIORITY_BY_RANK: AudioPriority[] = ["interactive", "background"];

export interface AudioRender {
  key: string;
  voice: string;
  renderVersion: number;
  lines: string[];
  status: AudioRenderStatus;
  priority: AudioPriority;
  attempts: number;
  requestedAt: Date;
  lineStartsSeconds: number[] | null;
  durationSeconds: number | null;
}

interface AudioRenderRow {
  key: string;
  voice: string;
  render_version: number;
  lines: string[];
  status: AudioRenderStatus;
  priority: number;
  attempts: number;
  requested_at: Date | string;
  line_starts: number[] | null;
  duration_seconds: number | null;
}

const COLUMNS = "key, voice, render_version, lines, status, priority, attempts, requested_at, line_starts, duration_seconds";

const fromRow = (row: AudioRenderRow): AudioRender => ({
  key: row.key,
  voice: row.voice,
  renderVersion: row.render_version,
  lines: row.lines,
  status: row.status,
  priority: PRIORITY_BY_RANK[row.priority]!,
  attempts: row.attempts,
  requestedAt: new Date(row.requested_at),
  lineStartsSeconds: row.line_starts,
  durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
});

export interface EnqueueAudio {
  key: string;
  voice: string;
  renderVersion: number;
  lines: string[];
  priority: AudioPriority;
  requestedBy: AccountId;
  now: Date;
}

// The queue the render workers drain, in Postgres so it outlives a stopped machine
// (docs/features/tts-pre-rendered-speech.md, "The API side").
export class AudioRendersRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async get(key: string): Promise<AudioRender | null> {
    const rows = await this.#sql.query<AudioRenderRow>(`select ${COLUMNS} from audio_renders where key = $1`, [key]);
    return rows[0] === undefined ? null : fromRow(rows[0]);
  }

  async outstandingFor(accountId: AccountId, exceptKey: string): Promise<number> {
    const rows = await this.#sql.query<{ count: number | string }>(
      `select count(*) as count from audio_renders
       where requested_by = $1 and status in ('queued', 'rendering') and key <> $2`,
      [accountId, exceptKey],
    );
    return Number(rows[0]?.count ?? 0);
  }

  // A request for audio already queued only ever makes it more urgent, and a request for
  // audio that failed for good starts it again from nothing.
  async enqueue({ key, voice, renderVersion, lines, priority, requestedBy, now }: EnqueueAudio): Promise<AudioRender> {
    const rows = await this.#sql.query<AudioRenderRow>(
      `insert into audio_renders
         (key, voice, render_version, lines, status, priority, attempts, not_before, requested_at, requested_by)
       values ($1, $2, $3, $4::jsonb, 'queued', $5, 0, $6::timestamptz, $6::timestamptz, $7)
       on conflict (key) do update set
         priority = least(audio_renders.priority, excluded.priority),
         status = case when audio_renders.status = 'failed' then 'queued' else audio_renders.status end,
         attempts = case when audio_renders.status = 'failed' then 0 else audio_renders.attempts end,
         not_before = case when audio_renders.status = 'failed' then excluded.not_before else audio_renders.not_before end,
         last_error = case when audio_renders.status = 'failed' then null else audio_renders.last_error end
       returning ${COLUMNS}`,
      [key, voice, renderVersion, JSON.stringify(lines), PRIORITY_RANK[priority], now.toISOString(), requestedBy],
    );
    return fromRow(rows[0]!);
  }

  // One job, most urgent then oldest, that no other worker holds. A render whose worker
  // went quiet past staleBefore is taken again, and one out of attempts is failed instead.
  async claimNext(now: Date, staleBefore: Date, maxAttempts: number): Promise<AudioRender | null> {
    return this.#sql.transaction(async (tx) => {
      await tx.query(
        `update audio_renders set status = 'failed', finished_at = $1::timestamptz,
           last_error = coalesce(last_error, 'The render stopped without finishing')
         where status = 'rendering' and started_at < $2::timestamptz and attempts >= $3`,
        [now.toISOString(), staleBefore.toISOString(), maxAttempts],
      );
      const rows = await tx.query<AudioRenderRow>(
        `update audio_renders set status = 'rendering', started_at = $1::timestamptz, attempts = attempts + 1
         where key = (
           select key from audio_renders
           where (status = 'queued' and not_before <= $1::timestamptz)
              or (status = 'rendering' and started_at < $2::timestamptz)
           order by priority, requested_at
           limit 1
           for update skip locked
         )
         returning ${COLUMNS}`,
        [now.toISOString(), staleBefore.toISOString()],
      );
      return rows[0] === undefined ? null : fromRow(rows[0]);
    });
  }

  async markReady(key: string, lineStartsSeconds: number[], durationSeconds: number, now: Date): Promise<void> {
    await this.#sql.query(
      `update audio_renders set status = 'ready', line_starts = $2::jsonb, duration_seconds = $3,
         finished_at = $4::timestamptz, last_error = null
       where key = $1`,
      [key, JSON.stringify(lineStartsSeconds), durationSeconds, now.toISOString()],
    );
  }

  async markAttemptFailed(key: string, error: string, retryAt: Date, maxAttempts: number, now: Date): Promise<AudioRenderStatus> {
    const rows = await this.#sql.query<{ status: AudioRenderStatus }>(
      `update audio_renders set
         status = case when attempts >= $4 then 'failed' else 'queued' end,
         not_before = $3::timestamptz, last_error = $2,
         finished_at = case when attempts >= $4 then $5::timestamptz else null end
       where key = $1
       returning status`,
      [key, error, retryAt.toISOString(), maxAttempts, now.toISOString()],
    );
    return rows[0]!.status;
  }
}
