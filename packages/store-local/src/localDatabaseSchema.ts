export const DATABASE_NAME = "overview-local-store";
export const DATABASE_VERSION = 5;

export const OVERVIEWS_STORE = "overviews";
export const TOPICS_STORE = "topics";
export const OVERVIEW_STATES_STORE = "overviewStates";
export const TRANSCRIPTS_STORE = "transcripts";
export const SETTINGS_STORE = "settings";
export const SETTINGS_KEY = "settings";
export const FOLLOWED_PLAYLISTS_STORE = "followedPlaylists";

// This device's own: what it has seen of each followed playlist, and what it has queued
// from them (docs/features/playlists.md, docs/features/capture-queue.md).
export const PLAYLIST_CHECKS_STORE = "playlistChecks";
export const CAPTURE_QUEUE_STORE = "captureQueue";

// The client half of sync, kept beside the records so that a write and its journal entry
// can share one transaction (docs/features/sync-client.md).
export const OUTBOX_STORE = "outbox";
export const SYNC_REVISIONS_STORE = "syncRevisions";
export const SYNC_META_STORE = "syncMeta";
export const SYNC_ENROLLED_KEY = "enrolled";
// Separate from the records' flag so a library enrolled before transcripts were synced
// still journals the ones it holds, once (docs/features/transcript-storage.md).
export const SYNC_TRANSCRIPTS_ENROLLED_KEY = "transcriptsEnrolled";
export const SYNC_CURSOR_KEY = "cursor";
// The kinds the cursor was pulled with. A cursor is only good for those, so a library that
// learns a new kind pulls again from the start (docs/features/sync-client.md).
export const SYNC_CURSOR_KINDS_KEY = "cursorKinds";
