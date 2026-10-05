import type { RateLimit } from "./RateLimit.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// Why each number is what it is: docs/architecture/api.md, "Rate limits".
export const rateLimits = {
  perAddress: { name: "address", limit: 1200, windowMs: MINUTE_MS },
  perAccount: { name: "account", limit: 600, windowMs: MINUTE_MS },
  magicLinkPerAddress: { name: "magicLinkAddress", limit: 20, windowMs: HOUR_MS },
  magicLinkPerEmail: { name: "magicLinkEmail", limit: 10, windowMs: HOUR_MS },
  signInPerAddress: { name: "signInAddress", limit: 30, windowMs: HOUR_MS },
  linkCodePerAddress: { name: "linkCodeAddress", limit: 30, windowMs: HOUR_MS },
  oauthRegisterPerAddress: { name: "oauthRegisterAddress", limit: 20, windowMs: HOUR_MS },
  oauthTokenPerAddress: { name: "oauthTokenAddress", limit: 60, windowMs: MINUTE_MS },
  mcpPerAccount: { name: "mcpAccount", limit: 120, windowMs: MINUTE_MS },
  sharedTranscriptPerAddress: { name: "sharedTranscriptAddress", limit: 300, windowMs: HOUR_MS },
  serviceTranscriptPerAddress: { name: "serviceTranscriptAddress", limit: 60, windowMs: HOUR_MS },
  eventsPerAccount: { name: "eventsAccount", limit: 60, windowMs: MINUTE_MS },
  anonymousEventsPerAddress: { name: "anonymousEventsAddress", limit: 60, windowMs: MINUTE_MS },
  sharedPageEventsPerAddress: { name: "sharedPageEventsAddress", limit: 60, windowMs: MINUTE_MS },
  errorsPerAddress: { name: "errorsAddress", limit: 30, windowMs: MINUTE_MS },
  sharePagePerAddress: { name: "sharePageAddress", limit: 600, windowMs: HOUR_MS },
} as const satisfies Record<string, RateLimit>;
