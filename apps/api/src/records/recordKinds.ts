import type { z } from "zod";
import {
  FOLLOWED_PLAYLIST_MIGRATIONS,
  FollowedPlaylist,
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  Overview,
  OverviewState,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  Project,
  ProjectMember,
  SETTINGS_MIGRATIONS,
  Settings,
  TOPIC_MIGRATIONS,
  Topic,
  type RecordMigration,
} from "@overview/domain";
import type { RecordKind } from "./RecordKind.js";

export interface RecordKindConfig {
  schema: z.ZodType<unknown>;
  migrations: readonly RecordMigration[];
}

// The same chain the clients run, imported rather than reimplemented
// (docs/features/record-migrations.md, "The server stores what it is given").
export const RECORD_KINDS: Record<RecordKind, RecordKindConfig> = {
  overview: { schema: Overview, migrations: OVERVIEW_MIGRATIONS },
  overviewState: { schema: OverviewState, migrations: OVERVIEW_STATE_MIGRATIONS },
  topic: { schema: Topic, migrations: TOPIC_MIGRATIONS },
  settings: { schema: Settings, migrations: SETTINGS_MIGRATIONS },
  followedPlaylist: { schema: FollowedPlaylist, migrations: FOLLOWED_PLAYLIST_MIGRATIONS },
  project: { schema: Project, migrations: PROJECT_MIGRATIONS },
  projectMember: { schema: ProjectMember, migrations: PROJECT_MEMBER_MIGRATIONS },
};
