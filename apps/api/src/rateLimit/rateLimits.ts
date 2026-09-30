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
} as const satisfies Record<string, RateLimit>;
