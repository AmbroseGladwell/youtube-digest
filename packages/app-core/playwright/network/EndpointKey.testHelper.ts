// Generation talks to providers straight from the browser, and the extension's shell lends
// it a fetch that reaches YouTube (docs/features/transcript-retrieval.md) — so these are
// the endpoints the IWFT network layer intercepts. The rest are our own API: the sync
// server's read side (docs/features/sync-client.md), the shared transcript cache
// (docs/features/shared-transcript-cache.md), sign-in (docs/features/sign-in.md)
// narration (docs/features/audio-player.md) and sharing (docs/features/sharing.md).
export enum EndpointKey {
  INNERTUBE_PLAYER = "INNERTUBE_PLAYER",
  YOUTUBE_TIMEDTEXT = "YOUTUBE_TIMEDTEXT",
  SUPADATA_METADATA = "SUPADATA_METADATA",
  SUPADATA_TRANSCRIPT = "SUPADATA_TRANSCRIPT",
  ANTHROPIC_MESSAGES = "ANTHROPIC_MESSAGES",
  SYNC_HANDSHAKE = "SYNC_HANDSHAKE",
  SYNC_CHANGES = "SYNC_CHANGES",
  SYNC_TRANSCRIPT = "SYNC_TRANSCRIPT",
  SHARED_TRANSCRIPT = "SHARED_TRANSCRIPT",
  AUTH_MAGIC_LINK = "AUTH_MAGIC_LINK",
  AUTH_SIGN_IN = "AUTH_SIGN_IN",
  AUTH_LINK_CODE = "AUTH_LINK_CODE",
  SESSION_LINK_CODE = "SESSION_LINK_CODE",
  SESSION_DELETE = "SESSION_DELETE",
  NARRATION_REQUEST = "NARRATION_REQUEST",
  NARRATION_STATUS = "NARRATION_STATUS",
  NARRATION_LOOKUP = "NARRATION_LOOKUP",
  NARRATION_DELETE = "NARRATION_DELETE",
  NARRATION_SAMPLES = "NARRATION_SAMPLES",
  SHARE_LIST = "SHARE_LIST",
  SHARE_CREATE = "SHARE_CREATE",
  SHARE_STOP = "SHARE_STOP",
}

export enum EndpointBehaviour {
  DEFAULT = "DEFAULT",
  ERROR = "ERROR",
  STALL = "STALL",
}
