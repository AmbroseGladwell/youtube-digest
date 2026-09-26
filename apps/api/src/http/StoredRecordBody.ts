import { z } from "zod";
import { UpdatedAt } from "./writeHeaders.js";

// A whole record as a client stores it: its own fields, plus the two stamps the local
// write seam put on it (docs/features/sync-metadata.md).
export const StoredRecordBody = z
  .object({ schemaVersion: z.int().min(1), updatedAt: UpdatedAt })
  .passthrough()
  .transform(({ schemaVersion, updatedAt, ...body }) => ({ schemaVersion, updatedAt, body }));
export type StoredRecordBody = z.infer<typeof StoredRecordBody>;
