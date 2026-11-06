import type { RecordMigration } from "./RecordMigration.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";

// Derivable: a playlist followed before there were paces was made as its videos came, so it
// keeps doing so. Only playlists followed afterwards start at the reader's default
// (docs/features/playlists.md, "A pace for each playlist").
const keepEarlierFollowsAsTheyCome: RecordMigration = {
  newSchemaVersion: 2,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return { pace: "asTheyCome", ...(record as Record<string, unknown>) };
  },
};

// Derivable: a playlist followed before there was an order was made oldest first, because
// that was the only order there was (docs/features/playlists.md, "An order for each
// playlist").
const keepEarlierFollowsOldestFirst: RecordMigration = {
  newSchemaVersion: 3,
  alterRecord: (record) => {
    if (typeof record !== "object" || record === null) {
      return record;
    }
    return { order: "oldestFirst", ...(record as Record<string, unknown>) };
  },
};

export const FOLLOWED_PLAYLIST_MIGRATIONS: readonly RecordMigration[] = [
  keepEarlierFollowsAsTheyCome,
  keepEarlierFollowsOldestFirst,
];

export const CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION = currentSchemaVersion(FOLLOWED_PLAYLIST_MIGRATIONS);
