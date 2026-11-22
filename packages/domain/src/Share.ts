import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { Overview } from "./Overview.js";
import { moveVideoToSource } from "./overviewMigrations.js";
import { ShareToken } from "./shareLink.js";
import { SharedNarration } from "./SharedOverview.js";
import { StoredTranscript } from "./StoredTranscript.js";

// The whole overview, so the server builds the copy itself (docs/features/sharing.md).
export const ShareRequest = z.object({
  overview: z.preprocess(moveVideoToSource, Overview),
  // Older clients still send the transcript; it is accepted and never kept (OV-295).
  transcript: StoredTranscript.nullable().default(null),
  narration: SharedNarration.nullable().default(null),
});
export type ShareRequest = z.infer<typeof ShareRequest>;

// contentHash detects edits since sharing; hasNarration lets audio rendered later be offered.
export const Share = z.object({
  token: ShareToken,
  url: z.url(),
  overviewId: OverviewId,
  title: z.string(),
  sharedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  views: z.number().int().nonnegative(),
  contentHash: z.string(),
  hasNarration: z.boolean(),
});
export type Share = z.infer<typeof Share>;

export const Shares = z.object({ shares: z.array(Share) });
export type Shares = z.infer<typeof Shares>;
