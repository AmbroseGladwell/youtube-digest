import { z } from "zod";
import { Plan } from "./Plan.js";

// An assistant asking to read a reader's overviews, as the consent screen shows it
// (docs/features/mcp-connector.md).
export const ConnectionRequest = z.object({
  id: z.string(),
  clientName: z.string().nullable(),
  redirectHost: z.string(),
  plan: Plan,
  expiresAt: z.string(),
});
export type ConnectionRequest = z.infer<typeof ConnectionRequest>;
