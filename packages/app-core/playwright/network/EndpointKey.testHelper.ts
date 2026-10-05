// Generation talks to providers straight from the browser, and the extension's shell lends
// it a fetch that reaches YouTube (docs/features/transcript-retrieval.md) — so these are
// the endpoints the IWFT network layer intercepts. The rest are our own API: the sync
// server's read side (docs/features/sync-client.md), the shared transcript cache
// (docs/features/shared-transcript-cache.md), our own server fetching transcripts
// (docs/architecture/server-side-transcripts.md), sign-in (docs/features/sign-in.md)
// narration (docs/features/audio-player.md), connecting an assistant
// (docs/features/mcp-connector.md), sharing (docs/features/sharing.md), analytics
// (docs/architecture/analytics.md) and errors (docs/architecture/errors-and-logs.md).
export enum EndpointKey {
  INNERTUBE_PLAYER = "INNERTUBE_PLAYER",
  YOUTUBE_TIMEDTEXT = "YOUTUBE_TIMEDTEXT",
  ANTHROPIC_MESSAGES = "ANTHROPIC_MESSAGES",
  SYNC_HANDSHAKE = "SYNC_HANDSHAKE",
  SYNC_CHANGES = "SYNC_CHANGES",
  SYNC_TRANSCRIPT = "SYNC_TRANSCRIPT",
  SHARED_TRANSCRIPT = "SHARED_TRANSCRIPT",
  SERVICE_TRANSCRIPT_STATUS = "SERVICE_TRANSCRIPT_STATUS",
  SERVICE_TRANSCRIPT = "SERVICE_TRANSCRIPT",
  AUTH_MAGIC_LINK = "AUTH_MAGIC_LINK",
  AUTH_SIGN_IN = "AUTH_SIGN_IN",
  AUTH_EMAIL_CODE = "AUTH_EMAIL_CODE",
  AUTH_LINK_CODE = "AUTH_LINK_CODE",
  SESSION_LINK_CODE = "SESSION_LINK_CODE",
  SESSION_DELETE = "SESSION_DELETE",
  SESSION_READ = "SESSION_READ",
  NARRATION_REQUEST = "NARRATION_REQUEST",
  NARRATION_STATUS = "NARRATION_STATUS",
  NARRATION_LOOKUP = "NARRATION_LOOKUP",
  NARRATION_DELETE = "NARRATION_DELETE",
  NARRATION_SAMPLES = "NARRATION_SAMPLES",
  CONNECTION_REQUEST = "CONNECTION_REQUEST",
  CONNECTION_DECISION = "CONNECTION_DECISION",
  CONNECTIONS_LIST = "CONNECTIONS_LIST",
  CONNECTION_REVOKE = "CONNECTION_REVOKE",
  SHARE_LIST = "SHARE_LIST",
  SHARE_CREATE = "SHARE_CREATE",
  SHARE_STOP = "SHARE_STOP",
  EVENTS = "EVENTS",
  EVENTS_DECLINED = "EVENTS_DECLINED",
  SHARED_PAGE_EVENTS = "SHARED_PAGE_EVENTS",
  ERRORS = "ERRORS",
  PLAYLIST_LOOKUP = "PLAYLIST_LOOKUP",
}

export enum EndpointBehaviour {
  DEFAULT = "DEFAULT",
  ERROR = "ERROR",
  STALL = "STALL",
}
