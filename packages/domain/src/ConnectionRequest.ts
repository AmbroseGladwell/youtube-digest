import { z } from "zod";

// An assistant asking to read a reader's overviews, and to mark them when `writes`, as the
// consent screen shows it. Readable without a session, so the reader sees what they are
// signing in for; their plan comes with their session (docs/features/mcp-connector.md).
export const ConnectionRequest = z.object({
  id: z.string(),
  clientName: z.string().nullable(),
  redirectHost: z.string(),
  writes: z.boolean(),
  expiresAt: z.string(),
});
export type ConnectionRequest = z.infer<typeof ConnectionRequest>;
