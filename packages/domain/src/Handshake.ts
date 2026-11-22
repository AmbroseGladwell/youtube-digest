import { z } from "zod";

// The write floor, and the server's CLIENT_VERSION: docs/features/record-migrations.md.
export const Handshake = z.object({
  minSupportedClientVersion: z.int().min(1),
  currentClientVersion: z.int().min(1),
});
export type Handshake = z.infer<typeof Handshake>;
