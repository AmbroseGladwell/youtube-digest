import type { SqlClient } from "../db/SqlClient.js";

export interface SeededSample {
  key: string;
  voice: string;
}

export interface ReadySample {
  key: string;
  voice: string;
  durationSeconds: number;
}

// Which renders are voice samples, and since when a sample has not been the current one
// (docs/features/narration-voice.md, "The samples").
export class VoiceSamplesRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async markCurrent(samples: readonly SeededSample[], now: Date): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      for (const { key, voice } of samples) {
        await tx.query(
          `insert into voice_samples (key, voice, seeded_at) values ($1, $2, $3::timestamptz)
           on conflict (key) do update set superseded_at = null`,
          [key, voice, now.toISOString()],
        );
      }
      await tx.query(
        `update voice_samples set superseded_at = $2::timestamptz
         where superseded_at is null and key not in (select jsonb_array_elements_text($1::jsonb))`,
        [JSON.stringify(samples.map((sample) => sample.key)), now.toISOString()],
      );
    });
  }

  async supersededBefore(cutoff: Date): Promise<string[]> {
    const rows = await this.#sql.query<{ key: string }>(
      "select key from voice_samples where superseded_at < $1::timestamptz order by key",
      [cutoff.toISOString()],
    );
    return rows.map((row) => row.key);
  }

  async ready(): Promise<ReadySample[]> {
    const rows = await this.#sql.query<{ key: string; voice: string; duration_seconds: number | string }>(
      `select s.key, s.voice, r.duration_seconds from voice_samples s join audio_renders r on r.key = s.key
       where s.superseded_at is null and r.status = 'ready'
       order by s.voice`,
    );
    return rows.map((row) => ({ key: row.key, voice: row.voice, durationSeconds: Number(row.duration_seconds) }));
  }
}
