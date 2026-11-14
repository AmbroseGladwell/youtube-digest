import type { SourceKey } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

// Where an episode's words can be had: the transcript its feed links, or the YouTube video it was
// matched to. A fact about the episode, shared between readers so the search isn't repeated, and
// never the words, which each reader fetches for themselves (docs/features/podcast-transcripts.md).
export type EpisodeWordSource = { via: "tag"; url: string; type: string } | { via: "youtube"; videoId: string };

export interface KnownWordSource {
  source: EpisodeWordSource;
  foundAt: Date;
}

export interface EpisodeWordSources {
  get(key: SourceKey): Promise<KnownWordSource | null>;
  put(key: SourceKey, source: EpisodeWordSource, at: Date): Promise<void>;
  forget(key: SourceKey): Promise<void>;
}

export class EpisodeWordSourcesRepository implements EpisodeWordSources {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async get(key: SourceKey): Promise<KnownWordSource | null> {
    const [row] = await this.#sql.query<{ via: string; url: string | null; type: string | null; video_id: string | null; found_at: Date }>(
      "select via, url, type, video_id, found_at from podcast_transcript_sources where episode_key = $1",
      [key],
    );
    if (row === undefined) return null;
    const foundAt = new Date(row.found_at);
    if (row.via === "tag" && row.url !== null && row.type !== null)
      return { source: { via: "tag", url: row.url, type: row.type }, foundAt };
    if (row.via === "youtube" && row.video_id !== null) return { source: { via: "youtube", videoId: row.video_id }, foundAt };
    return null;
  }

  async put(key: SourceKey, source: EpisodeWordSource, at: Date): Promise<void> {
    await this.#sql.query(
      `insert into podcast_transcript_sources (episode_key, via, url, type, video_id, found_at)
       values ($1, $2, $3, $4, $5, $6::timestamptz)
       on conflict (episode_key) do update
         set via = excluded.via, url = excluded.url, type = excluded.type, video_id = excluded.video_id, found_at = excluded.found_at`,
      [
        key,
        source.via,
        source.via === "tag" ? source.url : null,
        source.via === "tag" ? source.type : null,
        source.via === "youtube" ? source.videoId : null,
        at.toISOString(),
      ],
    );
  }

  async forget(key: SourceKey): Promise<void> {
    await this.#sql.query("delete from podcast_transcript_sources where episode_key = $1", [key]);
  }
}
