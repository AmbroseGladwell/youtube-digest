import { z } from "zod";
import { VideoId } from "./Brands.js";

// Best-effort by construction, and a separate parse rather than a relaxed Overview: the
// point is to turn a dead end into a choice, so every field catches to null rather than
// taking the record down with it (docs/features/record-migrations.md).
export const SalvagedOverview = z.object({
  savedAt: z.iso.datetime().nullable().catch(null),
  video: z
    .object({
      // The video id earns its place beside the url: the extension asks whether the
      // library already holds a video before offering to pay for it again, and that
      // question has to see quarantined records too
      // (docs/features/record-migrations.md).
      id: VideoId.nullable().catch(null),
      url: z.url().nullable().catch(null),
      title: z.string().nullable().catch(null),
    })
    .nullable()
    .catch(null),
});
export type SalvagedOverview = z.infer<typeof SalvagedOverview>;

export function salvageOverview(record: unknown): SalvagedOverview | null {
  return SalvagedOverview.safeParse(record).data ?? null;
}
