export const DATABASE_NAME = "overview-local-store";
export const DATABASE_VERSION = 4;

export const OVERVIEWS_STORE = "overviews";
export const TOPICS_STORE = "topics";
export const OVERVIEW_STATES_STORE = "overviewStates";
export const TRANSCRIPTS_STORE = "transcripts";
export const SETTINGS_STORE = "settings";
export const SETTINGS_KEY = "settings";

// The client half of sync, kept beside the records so that a write and its journal entry
// can share one transaction (docs/features/sync-client.md).
export const OUTBOX_STORE = "outbox";
export const SYNC_REVISIONS_STORE = "syncRevisions";
export const SYNC_META_STORE = "syncMeta";
export const SYNC_ENROLLED_KEY = "enrolled";
export const SYNC_CURSOR_KEY = "cursor";
