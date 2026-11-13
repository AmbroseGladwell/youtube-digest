import { z } from "zod";

export const Connection = z.object({
  id: z.string(),
  clientName: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  // Whether its scope lets it read what is known about the reader, which the reader's own
  // switch can still turn off (docs/features/mcp-connector.md, "The profile").
  readsProfile: z.boolean(),
  // Whether it can change the library, which a project page uses to offer it the job of
  // filling an empty project. False from a server that predates it (docs/features/projects.md).
  writes: z.boolean().default(false),
});
export type Connection = z.infer<typeof Connection>;

export const Connections = z.object({
  connections: z.array(Connection),
});
export type Connections = z.infer<typeof Connections>;
