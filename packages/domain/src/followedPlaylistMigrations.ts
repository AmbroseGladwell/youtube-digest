import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Earlier follows keep their pace: docs/features/playlists.md, "A pace for each playlist".
const keepEarlierFollowsAsTheyCome: RecordMigration = {
  newSchemaVersion: 2,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return { pace: "asTheyCome", ...(record as Record<string, unknown>) };
  },
};

// Earlier follows were oldest first: docs/features/playlists.md, "An order for each playlist".
const keepEarlierFollowsOldestFirst: RecordMigration = {
  newSchemaVersion: 3,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return { order: "oldestFirst", ...(record as Record<string, unknown>) };
  },
};

export const FOLLOWED_PLAYLIST_MIGRATIONS: readonly RecordMigration[] = [keepEarlierFollowsAsTheyCome, keepEarlierFollowsOldestFirst];

export const CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION = currentSchemaVersion(FOLLOWED_PLAYLIST_MIGRATIONS);
