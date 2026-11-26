import { Overview, OVERVIEW_MIGRATIONS, readStoredRecord, stampSchemaVersion } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { ClaimPair, ClaimPairsRepository } from "./ClaimPairsRepository.js";

export const RECENT_OVERVIEWS_PAIRED = 40;
export const PARTNERS_LOOKED_AT = 10;
export const PROJECT_MEMBERS_PAIRED = 30;

export type CandidateOrigin = "similarTo" | "crossTopic" | "closest" | "project";

export interface QuestionCandidate extends ClaimPair {
  origin: CandidateOrigin;
}

export interface CandidateSources {
  claimPairs: ClaimPairsRepository;
  records: RecordsRepository;
  model: string;
}

export const pairKeyOf = ({ first, second }: Pick<ClaimPair, "first" | "second">): string => [first, second].sort().join("|");

export const readOverviews = async (
  records: RecordsRepository,
  accountId: AccountId,
  ids: Iterable<string>,
): Promise<Map<string, Overview>> => {
  const unique = [...new Set(ids)];
  const rows = unique.length === 0 ? [] : await records.readLive(accountId, "overview", unique);
  return new Map(
    rows.flatMap((row) => {
      const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
      return read.status === "read" ? [[read.record.id as string, read.record] as const] : [];
    }),
  );
};

const sharesTopic = (left: Overview, right: Overview): boolean => left.topicIds.some((topic) => right.topicIds.includes(topic));

const interleaved = (lists: ReadonlyArray<readonly QuestionCandidate[]>): QuestionCandidate[] => {
  const seen = new Set<string>();
  const out: QuestionCandidate[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      const candidate = list[index];
      if (candidate !== undefined && !seen.has(pairKeyOf(candidate))) {
        seen.add(pairKeyOf(candidate));
        out.push(candidate);
      }
    }
  }
  return out;
};

// Recent saves first, from three sources in turn: docs/features/suggested-questions.md, "Candidates".
export const libraryCandidates = async (
  { claimPairs, records, model }: CandidateSources,
  accountId: AccountId,
): Promise<QuestionCandidate[]> => {
  const recent = await claimPairs.recentlySaved(accountId, model, RECENT_OVERVIEWS_PAIRED);
  const partners = await claimPairs.closestPartners(accountId, model, recent, PARTNERS_LOOKED_AT);
  const recentOverviews = await readOverviews(records, accountId, recent);
  const linked = [...recentOverviews.values()].flatMap((overview) =>
    (overview.verdict?.similarTo ?? []).map((similar) => similar.overviewId),
  );
  const overviews = await readOverviews(records, accountId, [...recent, ...partners.map((pair) => pair.second), ...linked]);

  const similar: QuestionCandidate[] = [];
  const crossTopic: QuestionCandidate[] = [];
  const closest: QuestionCandidate[] = [];
  for (const id of recent) {
    const overview = overviews.get(id);
    if (overview === undefined) {
      continue;
    }
    const own = partners.filter((pair) => pair.first === id && overviews.has(pair.second));
    if (own[0] !== undefined) {
      closest.push({ ...own[0], origin: "closest" });
    }
    const apart = own.find((pair) => !sharesTopic(overview, overviews.get(pair.second)!));
    if (apart !== undefined) {
      crossTopic.push({ ...apart, origin: "crossTopic" });
    }
    for (const { overviewId } of overview.verdict?.similarTo ?? []) {
      if (overviewId === id || !overviews.has(overviewId)) {
        continue;
      }
      const pair = own.find((each) => each.second === overviewId) ?? (await claimPairs.pairsAmong(accountId, model, [id, overviewId]))[0];
      if (pair !== undefined) {
        similar.push({ ...pair, origin: "similarTo" });
      }
    }
  }
  return interleaved([similar, crossTopic, closest]);
};

export const projectCandidates = async (
  { claimPairs, model }: Pick<CandidateSources, "claimPairs" | "model">,
  accountId: AccountId,
  membersNewestFirst: readonly string[],
): Promise<QuestionCandidate[]> =>
  (await claimPairs.pairsAmong(accountId, model, membersNewestFirst.slice(0, PROJECT_MEMBERS_PAIRED))).map((pair) => ({
    ...pair,
    origin: "project" as const,
  }));
