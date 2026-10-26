import { createHash } from "node:crypto";

// A reader's address is kept only as a truncated SHA-256: enough to count by, and no more
// (docs/architecture/server-side-transcripts.md, "Limits").
export const hashedAddress = (address: string): string =>
  createHash("sha256").update(address).digest("hex").slice(0, 32);
