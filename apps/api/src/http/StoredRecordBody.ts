import { z } from "zod";
import { UpdatedAt } from "./writeHeaders.js";

// The two stamps: docs/features/sync-metadata.md, "The write seam stamps; the migration seam does not".
export const StoredRecordBody = z
  .object({ schemaVersion: z.int().min(1), updatedAt: UpdatedAt })
  .passthrough()
  .transform(({ schemaVersion, updatedAt, ...body }) => ({ schemaVersion, updatedAt, body }));
export type StoredRecordBody = z.infer<typeof StoredRecordBody>;
