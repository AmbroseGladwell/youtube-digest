import {
  isInProject,
  Overview,
  OVERVIEW_MIGRATIONS,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  Project,
  ProjectMember,
  readStoredRecord,
  stampSchemaVersion,
  Topic,
  TOPIC_MIGRATIONS,
  type ChatQuestionRequest,
  type ChatSource,
  type OverviewId,
  type ProjectId,
  type RecordMigration,
  type TopicId,
} from "@overview/domain";
import type { z } from "zod";
import type { AccountId } from "../auth/AccountId.js";
import type { MeaningSearch } from "../meaning/MeaningSearch.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";

export const FOUND_SOURCES = 3;
// Why 0.40: docs/features/chats.md, "Other overviews".
export const FOUND_FLOOR = 0.4;
export const PINNED_PROJECT_WHOLE = 8;
export const PINNED_PROJECT_CLOSEST = 5;

export interface OtherSourcesChoice {
  added: ChatSource[];
  searched: boolean;
}

export interface OtherSourcesAsk {
  accountId: AccountId;
  home: string;
  question: ChatQuestionRequest;
  inConversation: ReadonlySet<string>;
  setAside: ReadonlySet<string>;
  nextLabel: number;
}

const readAll = <T>(rows: readonly StoredRecord[], schema: z.ZodType<T>, migrations: readonly RecordMigration[]): T[] => {
  return rows.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schemaVersion), schema, migrations);
    return read.status === "read" ? [read.record] : [];
  });
};

type PinnedVia = { projectId: ProjectId } | { topicId: TopicId };

interface Candidate {
  overviewId: OverviewId;
  how: ChatSource["how"];
  projectId?: ProjectId;
  topicId?: TopicId;
  brief?: boolean;
}

// A pinned project or topic: whole when small, else the closest in full and the rest in brief.
const pinnedGroup = async (
  meaningSearch: MeaningSearch | null,
  accountId: AccountId,
  text: string,
  ids: readonly OverviewId[],
  via: PinnedVia,
): Promise<Candidate[]> => {
  const whole = ids.length <= PINNED_PROJECT_WHOLE ? [...ids] : await closestPinnedProjectMembers(meaningSearch, accountId, text, ids);
  return [
    ...whole.map((overviewId): Candidate => ({ overviewId, how: "pinned", ...via })),
    ...ids.filter((id) => !whole.includes(id)).map((overviewId): Candidate => ({ overviewId, how: "pinned", ...via, brief: true })),
  ];
};

// What a question adds, and what it never adds: docs/features/chats.md, "Other overviews".
export const chooseOtherSources = async (
  records: RecordsRepository,
  meaningSearch: MeaningSearch | null,
  { accountId, home, question, inConversation, setAside, nextLabel }: OtherSourcesAsk,
): Promise<OtherSourcesChoice> => {
  const candidates: Candidate[] = question.pins.overviews.map((overviewId) => ({ overviewId, how: "pinned" }));

  const projects = readAll(await records.readLive(accountId, "project", question.pins.projects), Project, PROJECT_MIGRATIONS);
  for (const project of projects) {
    const members = readAll(await records.listLive(accountId, "projectMember", `${project.id}:%`), ProjectMember, PROJECT_MEMBER_MIGRATIONS)
      .filter((member) => isInProject(member) && member.overviewId !== home)
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
    const live = new Set(
      readAll(
        await records.readLive(
          accountId,
          "overview",
          members.map((member) => member.overviewId),
        ),
        Overview,
        OVERVIEW_MIGRATIONS,
      ).map((overview) => overview.id),
    );
    const ids = members.map((member) => member.overviewId).filter((id) => live.has(id));
    candidates.push(...(await pinnedGroup(meaningSearch, accountId, question.text, ids, { projectId: project.id })));
  }

  const topics = readAll(await records.readLive(accountId, "topic", question.pins.topics), Topic, TOPIC_MIGRATIONS);
  if (topics.length > 0) {
    const newestFirst = readAll(await records.listLive(accountId, "overview", "%"), Overview, OVERVIEW_MIGRATIONS)
      .filter((overview) => overview.id !== home)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    for (const topic of topics) {
      const ids = newestFirst.filter((overview) => overview.topicIds.includes(topic.id)).map((overview) => overview.id);
      candidates.push(...(await pinnedGroup(meaningSearch, accountId, question.text, ids, { topicId: topic.id })));
    }
  }

  const pinned = new Set<string>(candidates.map((candidate) => candidate.overviewId));
  let searched = false;
  if (meaningSearch !== null) {
    const result = await meaningSearch.search(accountId, question.text);
    if (result.available) {
      searched = true;
      const closest = result.matches
        .filter((match) => match.similarity >= FOUND_FLOOR)
        .map((match) => match.overviewId as OverviewId)
        .filter((id) => id !== home && !setAside.has(id) && !pinned.has(id))
        .slice(0, FOUND_SOURCES);
      candidates.push(...closest.map((overviewId): Candidate => ({ overviewId, how: "found" })));
    }
  }

  const wanted = candidates.filter((candidate) => candidate.overviewId !== home && !inConversation.has(candidate.overviewId));
  const overviews = new Map(
    readAll(
      await records.readLive(accountId, "overview", [...new Set(wanted.map((candidate) => candidate.overviewId))]),
      Overview,
      OVERVIEW_MIGRATIONS,
    ).map((overview) => [overview.id, overview]),
  );
  const added: ChatSource[] = [];
  const seen = new Set<string>();
  for (const candidate of wanted) {
    const overview = overviews.get(candidate.overviewId);
    if (overview === undefined || seen.has(candidate.overviewId)) {
      continue;
    }
    seen.add(candidate.overviewId);
    added.push({
      label: `S${nextLabel + added.length}`,
      overviewId: candidate.overviewId,
      title: overview.source.title,
      how: candidate.how,
      ...(candidate.projectId === undefined ? {} : { projectId: candidate.projectId }),
      ...(candidate.topicId === undefined ? {} : { topicId: candidate.topicId }),
      ...(candidate.brief === true ? { brief: true } : {}),
    });
  }
  return { added, searched };
};

const closestPinnedProjectMembers = async (
  meaningSearch: MeaningSearch | null,
  accountId: AccountId,
  text: string,
  ids: readonly OverviewId[],
): Promise<OverviewId[]> => {
  const result = meaningSearch === null ? null : await meaningSearch.search(accountId, text, { within: ids });
  const ranked = result?.available === true ? result.matches.flatMap((match) => ids.filter((id) => id === match.overviewId)) : [];
  return [...new Set([...ranked, ...ids])].slice(0, PINNED_PROJECT_CLOSEST);
};
