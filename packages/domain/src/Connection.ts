import { z } from "zod";

export const Connection = z.object({
  id: z.string(),
  clientName: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
});
export type Connection = z.infer<typeof Connection>;

export const Connections = z.object({
  connections: z.array(Connection),
});
export type Connections = z.infer<typeof Connections>;
