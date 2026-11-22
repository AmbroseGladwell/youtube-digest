import {
  isEmptyTranscriptQuery,
  Overview,
  OVERVIEW_MIGRATIONS,
  readStoredRecord,
  sourceKey,
  stampSchemaVersion,
  StoredTranscript,
  transcriptBlocks,
  transcriptQueryOf,
  transcriptSnippet,
  type TranscriptMoment,
  type VideoId,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { TranscriptPassagesRepository } from "./TranscriptPassagesRepository.js";
import type { TranscriptsRepository } from "./TranscriptsRepository.js";

export const TRANSCRIPT_RESULTS = 30;
export const MOMENTS_PER_SOURCE = 3;

export interface TranscriptMatch {
  overview: Overview;
  mentions: number;
  moments: TranscriptMoment[];
}

export interface TranscriptMatchesOptions {
  limit?: number;
  withinSources?: readonly string[] | null;
}

export interface TranscriptMatchesDeps {
  passages: TranscriptPassagesRepository;
  records: RecordsRepository;
  transcripts: TranscriptsRepository;
}

const liveOverviewsBySource = async (records: RecordsRepository, accountId: AccountId, keys: string[]): Promise<Map<string, Overview>> => {
  const bySource = new Map<string, Overview>();
  for (const record of await records.liveOverviewsOfSources(accountId, keys)) {
    const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
    const key = read.status === "read" ? sourceKey(read.record.source) : null;
    if (read.status === "read" && key !== null && !bySource.has(key)) {
      bySource.set(key, read.record);
    }
  }
  return bySource;
};

// One account's transcripts only, most mentions first: docs/features/transcript-search.md.
export const transcriptMatches = async (
  { passages, records, transcripts }: TranscriptMatchesDeps,
  accountId: AccountId,
  text: string,
  { limit = TRANSCRIPT_RESULTS, withinSources = null }: TranscriptMatchesOptions = {},
): Promise<TranscriptMatch[]> => {
  const query = transcriptQueryOf(text);
  if (isEmptyTranscriptQuery(query)) {
    return [];
  }
  await passages.backfill(accountId);
  const hits = await passages.matching(accountId, query, MOMENTS_PER_SOURCE, withinSources);
  const sources = [...new Set(hits.map((hit) => hit.videoId))];
  const live = await liveOverviewsBySource(records, accountId, sources);
  const matches: TranscriptMatch[] = [];
  for (const source of sources.filter((key) => live.has(key)).slice(0, limit)) {
    const stored = StoredTranscript.safeParse(await transcripts.get(accountId, source as VideoId));
    if (!stored.success) {
      continue;
    }
    const blocks = transcriptBlocks(stored.data.segments);
    const ofSource = hits.filter((hit) => hit.videoId === source);
    const moments = ofSource
      .flatMap((hit) => transcriptSnippet(blocks, hit, query) ?? [])
      .filter((moment, index, all) => all.findIndex((other) => other.startMs === moment.startMs) === index);
    if (moments.length > 0) {
      matches.push({ overview: live.get(source)!, mentions: ofSource[0]!.mentions, moments });
    }
  }
  return matches;
};
