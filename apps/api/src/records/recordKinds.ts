import type { z } from "zod";
import {
  CAPTURE_MIGRATIONS,
  Capture,
  CHAT_MIGRATIONS,
  Chat,
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
  SUGGESTED_QUESTION_MIGRATIONS,
  SuggestedQuestion,
  TOPIC_MIGRATIONS,
  Topic,
  type RecordMigration,
} from "@overview/domain";
import type { RecordKind } from "./RecordKind.js";

export interface RecordKindConfig {
  schema: z.ZodType<unknown>;
  migrations: readonly RecordMigration[];
}

export const RECORD_KINDS: Record<RecordKind, RecordKindConfig> = {
  overview: { schema: Overview, migrations: OVERVIEW_MIGRATIONS },
  overviewState: { schema: OverviewState, migrations: OVERVIEW_STATE_MIGRATIONS },
  topic: { schema: Topic, migrations: TOPIC_MIGRATIONS },
  settings: { schema: Settings, migrations: SETTINGS_MIGRATIONS },
  followedPlaylist: { schema: FollowedPlaylist, migrations: FOLLOWED_PLAYLIST_MIGRATIONS },
  project: { schema: Project, migrations: PROJECT_MIGRATIONS },
  projectMember: { schema: ProjectMember, migrations: PROJECT_MEMBER_MIGRATIONS },
  chat: { schema: Chat, migrations: CHAT_MIGRATIONS },
  suggestedQuestion: { schema: SuggestedQuestion, migrations: SUGGESTED_QUESTION_MIGRATIONS },
  capture: { schema: Capture, migrations: CAPTURE_MIGRATIONS },
};
