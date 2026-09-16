// Model D (docs/architecture/v1-architecture-decisions.md) means this app's "backend"
// for generation is the real Anthropic and Supadata APIs, called directly from the
// browser — there is no server of ours to simulate instead, so these are the endpoints
// the IWFT network layer intercepts.
export enum EndpointKey {
  SUPADATA_METADATA = "SUPADATA_METADATA",
  SUPADATA_TRANSCRIPT = "SUPADATA_TRANSCRIPT",
  ANTHROPIC_MESSAGES = "ANTHROPIC_MESSAGES",
}

export enum EndpointBehaviour {
  DEFAULT = "DEFAULT",
  ERROR = "ERROR",
  STALL = "STALL",
}
