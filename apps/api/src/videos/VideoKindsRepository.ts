import { NoteKind, type VideoId } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";

// The cap's reason: docs/features/onboarding.md, "Nothing paid before the account".
export const SIGNED_OUT_KIND_CHECKS_DAILY = 300;

// The kind is the video's, not the reader's, so a link anyone has pasted costs nothing again.
export class VideoKindsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async kindOf(videoId: VideoId): Promise<NoteKind | null> {
    const [row] = await this.#sql.query<{ note_kind: string }>("select note_kind from video_kinds where video_id = $1", [videoId]);
    return row === undefined ? null : NoteKind.parse(row.note_kind);
  }

  async remember(now: Date, videoId: VideoId, kind: NoteKind): Promise<void> {
    await this.#sql.query(
      `insert into video_kinds (video_id, note_kind, checked_at) values ($1, $2, $3::timestamptz)
       on conflict (video_id) do update set note_kind = excluded.note_kind, checked_at = excluded.checked_at`,
      [videoId, kind, now.toISOString()],
    );
  }

  async reserveSignedOutCheck(now: Date): Promise<boolean> {
    const rows = await this.#sql.query(
      `insert into video_kind_checks_signed_out (day, checks) values ($1::date, 1)
       on conflict (day) do update set checks = video_kind_checks_signed_out.checks + 1
       where video_kind_checks_signed_out.checks < $2
       returning checks`,
      [usageDay(now), SIGNED_OUT_KIND_CHECKS_DAILY],
    );
    return rows.length > 0;
  }
}
