import { z } from "zod";

// Readable without a session, so the reader sees what they sign in for (docs/features/mcp-connector.md).
export const ConnectionRequest = z.object({
  id: z.string(),
  clientName: z.string().nullable(),
  redirectHost: z.string(),
  writes: z.boolean(),
  readsProfile: z.boolean(),
  expiresAt: z.string(),
});
export type ConnectionRequest = z.infer<typeof ConnectionRequest>;
