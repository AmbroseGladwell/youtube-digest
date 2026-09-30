import { z } from "zod";

// Where an assistant sends a reader to answer its request, and the one place a sign-in
// link may return to (docs/features/mcp-connector.md, "The consent screen").
const CONSENT_PATH = /^\/connect\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const consentPath = (requestId: string): string => `/connect/${requestId}`;

export const isConsentPath = (path: string): boolean => CONSENT_PATH.test(path);

export const ConsentPath = z.string().refine(isConsentPath, "Not a consent screen's path");
