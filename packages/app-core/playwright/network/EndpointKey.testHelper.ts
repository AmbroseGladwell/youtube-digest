// Generation talks to providers straight from the browser, and the extension's shell lends
// it a fetch that reaches YouTube (docs/features/transcript-retrieval.md) — so these are
// the endpoints the IWFT network layer intercepts. There is still no server of ours.
export enum EndpointKey {
  INNERTUBE_PLAYER = "INNERTUBE_PLAYER",
  YOUTUBE_TIMEDTEXT = "YOUTUBE_TIMEDTEXT",
  SUPADATA_METADATA = "SUPADATA_METADATA",
  SUPADATA_TRANSCRIPT = "SUPADATA_TRANSCRIPT",
  ANTHROPIC_MESSAGES = "ANTHROPIC_MESSAGES",
}

export enum EndpointBehaviour {
  DEFAULT = "DEFAULT",
  ERROR = "ERROR",
  STALL = "STALL",
}
