import type { z } from "zod";
import {
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  Overview,
  OverviewState,
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
};
