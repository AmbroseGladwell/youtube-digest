import { z } from "zod";
import { VideoId } from "./Brands.js";
import { moveVideoToSource } from "./overviewMigrations.js";

// Every field catches to null, so a salvage never fails (docs/features/record-migrations.md).
export const SalvagedOverview = z.object({
  savedAt: z.iso.datetime().nullable().catch(null),
  source: z
    .object({
      kind: z.string().catch("youtube"),
      // The extension checks quarantined records too before paying again (docs/features/record-migrations.md).
      id: VideoId.nullable().catch(null),
      url: z.url().nullable().catch(null),
      title: z.string().nullable().catch(null),
    })
    .nullable()
    .catch(null),
});
export type SalvagedOverview = z.infer<typeof SalvagedOverview>;

export const salvageOverview = (record: unknown): SalvagedOverview | null => {
  return SalvagedOverview.safeParse(moveVideoToSource(record)).data ?? null;
};
