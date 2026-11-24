import { z } from "zod";

// One device makes a queued source at a time: docs/features/kept-links.md, "Made once".
export const CaptureClaim = z.object({ until: z.iso.datetime() });
export type CaptureClaim = z.infer<typeof CaptureClaim>;

export const CaptureClaimRequest = z.object({ holder: z.string().min(8).max(64) });
export type CaptureClaimRequest = z.infer<typeof CaptureClaimRequest>;
