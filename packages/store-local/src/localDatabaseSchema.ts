export const DATABASE_NAME = "overview-local-store";
export const DATABASE_VERSION = 9;

export const OVERVIEWS_STORE = "overviews";
export const TOPICS_STORE = "topics";
export const OVERVIEW_STATES_STORE = "overviewStates";
export const TRANSCRIPTS_STORE = "transcripts";
export const SETTINGS_STORE = "settings";
export const SETTINGS_KEY = "settings";
export const FOLLOWED_PLAYLISTS_STORE = "followedPlaylists";
export const PROJECTS_STORE = "projects";
export const PROJECT_MEMBERS_STORE = "projectMembers";
export const MEMBERS_BY_PROJECT_INDEX = "byProject";
export const MEMBERS_BY_OVERVIEW_INDEX = "byOverview";
export const CHATS_STORE = "chats";
export const CHATS_BY_OVERVIEW_INDEX = "byOverview";
export const CHATS_BY_PROJECT_INDEX = "byProject";
export const SUGGESTED_QUESTIONS_STORE = "suggestedQuestions";
export const QUESTIONS_BY_OVERVIEW_INDEX = "byOverview";
export const QUESTIONS_BY_PROJECT_INDEX = "byProject";

// This device's own: docs/features/capture-queue.md, "On this device, for now".
export const PLAYLIST_CHECKS_STORE = "playlistChecks";
export const CAPTURE_QUEUE_STORE = "captureQueue";

// Beside the records, so a write and its journal entry share one transaction.
export const OUTBOX_STORE = "outbox";
export const SYNC_REVISIONS_STORE = "syncRevisions";
export const SYNC_META_STORE = "syncMeta";
export const SYNC_ENROLLED_KEY = "enrolled";
// Apart from the records' flag, so a library enrolled before transcripts synced journals them once.
export const SYNC_TRANSCRIPTS_ENROLLED_KEY = "transcriptsEnrolled";
export const SYNC_CURSOR_KEY = "cursor";
// A cursor is only good for its kinds: docs/features/sync-client.md, "What comes down".
export const SYNC_CURSOR_KINDS_KEY = "cursorKinds";
