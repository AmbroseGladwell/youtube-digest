import { StoredTranscript } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { transcriptPassages, type Passage } from "../chats/transcriptPassages.js";

const STOPWORDS = new Set(
  "a an and are as at be been but by can could did do does doing for from had has have he her his how i if in into is it its just me my of on or our out she so than that the their them then there these they this to up was we were what when where which who why will with would you your about after all also any because before being both each few more most much no not now only other over own same should some such too under until very via whom yours say says said tell told saved video videos overview overviews episode".split(
    " ",
  ),
);
const MOST_TERMS = 12;

// A question's words worth searching for: lower-cased letters and digits, without the words every
// question has, at most a dozen. Postgres stems them, as it stemmed the passages.
export function keywordTermsOf(question: string): string[] {
  const words = question
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
  return [...new Set(words)].slice(0, MOST_TERMS);
}

export interface KeywordHit {
  videoId: string;
  passage: Passage;
  // The passage with the minute either side, which OV-352 measured: 54 of 68 answers cited the
  // right moment with them, against 45 without.
  around: Passage[];
  score: number;
}

// The account's transcripts as minute passages under a full-text index, searched by the
// question's words. Postgres's ts_rank knows nothing of how rare a word is, so each word is
// weighted by its inverse document frequency over this account's passages, as BM25 weights it:
// the rare word that names the detail counts for more than the word every minute has (OV-352).
export class TranscriptPassagesRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  // Run inside the transcript's own write, so the index never lags the transcript it is cut from.
  static async index(tx: SqlClient, accountId: AccountId, videoId: string, transcript: StoredTranscript): Promise<void> {
    await tx.query("delete from transcript_passages where account_id = $1 and video_id = $2", [accountId, videoId]);
    const passages = transcriptPassages(transcript.segments).filter((passage) => passage.text.length > 0);
    if (passages.length === 0) return;
    await tx.query(
      `insert into transcript_passages (account_id, video_id, passage_id, start_ms, end_ms, terms)
       select $1, $2, p.id, p.start_ms, p.end_ms, to_tsvector('english', p.body)
         from unnest($3::text[], $4::int[], $5::int[], $6::text[]) as p(id, start_ms, end_ms, body)`,
      [
        accountId,
        videoId,
        passages.map((passage) => passage.id),
        passages.map((passage) => passage.startMs),
        passages.map((passage) => passage.endMs),
        passages.map((passage) => passage.text),
      ],
    );
  }

  // Transcripts kept before the index existed, or whose index went missing, cut on first search.
  async backfill(accountId: AccountId): Promise<number> {
    const rows = await this.#sql.query<{ video_id: string; body: unknown }>(
      `select t.video_id, t.body from account_transcripts t
        where t.account_id = $1
          and not exists (select 1 from transcript_passages p where p.account_id = t.account_id and p.video_id = t.video_id)`,
      [accountId],
    );
    let indexed = 0;
    for (const row of rows) {
      const parsed = StoredTranscript.safeParse(row.body);
      if (!parsed.success) continue;
      await this.#sql.transaction((tx) => TranscriptPassagesRepository.index(tx, accountId, row.video_id, parsed.data));
      indexed += 1;
    }
    return indexed;
  }

  // The best passages for the question's words, from the given transcripts only when `within` is
  // set, never from those in `except`. Only transcripts of the account's live overviews are kept,
  // so a passage never outlives the note it came with.
  async search(
    accountId: AccountId,
    question: string,
    { limit, except = [], within = null }: { limit: number; except?: readonly string[]; within?: readonly string[] | null },
  ): Promise<KeywordHit[]> {
    const terms = keywordTermsOf(question);
    if (terms.length === 0 || limit <= 0) return [];
    const rows = await this.#sql.query<{ video_id: string; passage_id: string; score: number }>(
      `with q as (
         select term, plainto_tsquery('english', term) as query from unnest($2::text[]) as term
       ),
       scoped as (
         select p.* from transcript_passages p
          where p.account_id = $1
            and not (p.video_id = any($3::text[]))
            and ($4::text[] is null or p.video_id = any($4::text[]))
       ),
       weighted as (
         select q.query,
                ln(1 + ((select count(*) from scoped) - count(s.*) + 0.5) / (count(s.*) + 0.5)) as idf
           from q left join scoped s on s.terms @@ q.query
          where q.query::text <> ''
          group by q.query
       )
       select s.video_id, s.passage_id, s.start_ms, sum(w.idf * ts_rank(s.terms, w.query, 1)) as score
         from scoped s join weighted w on s.terms @@ w.query
        group by s.video_id, s.passage_id, s.start_ms
        order by score desc, s.video_id, s.start_ms
        limit $5`,
      [accountId, terms, [...except], within === null ? null : [...within], limit],
    );
    const cut = await this.#passagesOf(accountId, [...new Set(rows.map((row) => row.video_id))]);
    return rows.flatMap((row) => {
      const all = cut.get(row.video_id) ?? [];
      const at = all.findIndex((passage) => passage.id === row.passage_id);
      if (at === -1) return [];
      return [{ videoId: row.video_id, passage: all[at]!, around: all.slice(Math.max(0, at - 1), at + 2), score: Number(row.score) }];
    });
  }

  // A hit's words, cut again from its transcript the way they were indexed.
  async #passagesOf(accountId: AccountId, videoIds: readonly string[]): Promise<Map<string, Passage[]>> {
    if (videoIds.length === 0) return new Map();
    const rows = await this.#sql.query<{ video_id: string; body: unknown }>(
      "select video_id, body from account_transcripts where account_id = $1 and video_id = any($2::text[])",
      [accountId, [...videoIds]],
    );
    return new Map(
      rows.flatMap((row) => {
        const parsed = StoredTranscript.safeParse(row.body);
        return parsed.success ? [[row.video_id, transcriptPassages(parsed.data.segments)] as const] : [];
      }),
    );
  }
}
