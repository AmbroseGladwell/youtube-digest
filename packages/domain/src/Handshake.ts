import { z } from "zod";

// Two numbers and no more: below the first, writes are refused; the second is the
// server's own CLIENT_VERSION, so a web client can tell that a reload is all it needs
// (docs/features/record-migrations.md, docs/architecture/api.md).
export const Handshake = z.object({
  minSupportedClientVersion: z.int().min(1),
  currentClientVersion: z.int().min(1),
});
export type Handshake = z.infer<typeof Handshake>;
