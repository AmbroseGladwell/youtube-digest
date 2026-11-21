import type { FastifyBaseLogger } from "fastify";
import {
  apiLogLines,
  Overview,
  OVERVIEW_MIGRATIONS,
  readStoredRecord,
  sourceKey,
  stampSchemaVersion,
  StoredTranscript,
  type OverviewId,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { TranscriptPassagesRepository } from "../transcripts/TranscriptPassagesRepository.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { transcriptPassages, type Passage } from "./transcriptPassages.js";

export const KEYWORD_MINUTES = 8;

// The minutes of one overview's transcript a question was sent: the best keyword hits in it, each
// with the minute either side.
export interface OverviewMinutes {
  overviewId: OverviewId;
  overview: Overview;
  passages: Passage[];
}

// The 8 best minutes for a question's words across the account's transcripts, each with its
// neighbours, grouped by the live overview they belong to, best first (OV-352). Search failing never
// stops the answer: it goes on without minutes, and the log says so.
export async function keywordMinutes(
  { passages, records }: { passages: TranscriptPassagesRepository; records: RecordsRepository },
  accountId: AccountId,
  question: string,
  { except = [], within = null }: { except?: readonly string[]; within?: readonly string[] | null },
  log: FastifyBaseLogger,
): Promise<OverviewMinutes[]> {
  let hits;
  try {
    await passages.backfill(accountId);
    hits = await passages.search(accountId, question, { limit: KEYWORD_MINUTES, except, within });
  } catch (error) {
    log.warn(apiLogLines.chat.keywordSearchFailed({ reason: error instanceof Error ? error.constructor.name : "unknown" }));
    return [];
  }
  const live = await records.liveOverviewsOfSources(accountId, [...new Set(hits.map((hit) => hit.videoId))]);
  const overviewOf = new Map<string, Overview>();
  for (const record of live) {
    const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
    const key = read.status === "read" ? sourceKey(read.record.source) : null;
    if (read.status === "read" && key !== null && !overviewOf.has(key)) overviewOf.set(key, read.record);
  }
  const grouped = new Map<string, OverviewMinutes>();
  for (const hit of hits) {
    const overview = overviewOf.get(hit.videoId);
    if (overview === undefined) continue;
    const held = grouped.get(overview.id) ?? { overviewId: overview.id as OverviewId, overview, passages: [] };
    for (const passage of hit.around) if (!held.passages.some((other) => other.id === passage.id)) held.passages.push(passage);
    grouped.set(overview.id, held);
  }
  return [...grouped.values()].map((minutes) => ({ ...minutes, passages: minutes.passages.sort((a, b) => a.startMs - b.startMs) }));
}

// Every minute of these overviews' transcripts, cut again, so an earlier question's minutes rebuild
// as they were sent. A transcript gone since leaves its overview out.
export async function transcriptMinutes(
  transcripts: TranscriptsRepository,
  accountId: AccountId,
  overviews: ReadonlyArray<Overview>,
): Promise<Map<string, Passage[]>> {
  const cut = new Map<string, Passage[]>();
  for (const overview of overviews) {
    const key = sourceKey(overview.source);
    if (key === null || cut.has(overview.id)) continue;
    const stored = StoredTranscript.safeParse(await transcripts.get(accountId, key as never));
    if (stored.success) cut.set(overview.id, transcriptPassages(stored.data.segments));
  }
  return cut;
}
