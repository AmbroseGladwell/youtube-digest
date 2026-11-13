import {
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  Overview,
  OverviewState,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  Project,
  ProjectMember,
  TOPIC_MIGRATIONS,
  Topic,
  readStoredRecord,
  stampSchemaVersion,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { Library, LibraryEntry } from "./Library.js";

interface LiveRecordRow {
  kind: "overview" | "overviewState" | "topic" | "project" | "projectMember";
  schema_version: number;
  body: Record<string, unknown>;
}

// Read whole and filtered in memory, because a filter can only be trusted on a record that
// has been migrated to the current shape (docs/features/mcp-connector.md, "Search").
export async function readLibrary(sql: SqlClient, accountId: AccountId): Promise<Library> {
  const rows = await sql.query<LiveRecordRow>(
    `select kind, schema_version, body from records
      where account_id = $1 and not deleted and kind in ('overview', 'overviewState', 'topic', 'project', 'projectMember')`,
    [accountId],
  );
  const overviews: Overview[] = [];
  const states = new Map<string, OverviewState>();
  const topics: Topic[] = [];
  const projects: Project[] = [];
  const members: ProjectMember[] = [];
  let unreadable = 0;

  for (const row of rows) {
    const raw = stampSchemaVersion(row.body, row.schema_version);
    if (row.kind === "overview") {
      const read = readStoredRecord(raw, Overview, OVERVIEW_MIGRATIONS);
      if (read.status === "read") {
        overviews.push(read.record);
      } else {
        unreadable += 1;
      }
    } else if (row.kind === "overviewState") {
      const read = readStoredRecord(raw, OverviewState, OVERVIEW_STATE_MIGRATIONS);
      if (read.status === "read") {
        states.set(read.record.overviewId, read.record);
      }
    } else if (row.kind === "project") {
      const read = readStoredRecord(raw, Project, PROJECT_MIGRATIONS);
      if (read.status === "read") {
        projects.push(read.record);
      }
    } else if (row.kind === "projectMember") {
      const read = readStoredRecord(raw, ProjectMember, PROJECT_MEMBER_MIGRATIONS);
      if (read.status === "read") {
        members.push(read.record);
      }
    } else {
      const read = readStoredRecord(raw, Topic, TOPIC_MIGRATIONS);
      if (read.status === "read") {
        topics.push(read.record);
      }
    }
  }

  const entries: LibraryEntry[] = overviews
    .map((overview) => ({ overview, state: states.get(overview.id) ?? null }))
    .sort((left, right) => right.overview.savedAt.localeCompare(left.overview.savedAt));
  return { entries, topics, projects, members, unreadable };
}
