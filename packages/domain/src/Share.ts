import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { Overview } from "./Overview.js";
import { ShareToken } from "./shareLink.js";
import { SharedNarration } from "./SharedOverview.js";
import { StoredTranscript } from "./StoredTranscript.js";

// What the reader posts to make or replace a link: the whole overview, so the server builds
// the shared copy itself through shareSnapshot rather than trusting one the client
// assembled (docs/features/sharing.md).
export const ShareRequest = z.object({
  overview: Overview,
  transcript: StoredTranscript.nullable().default(null),
  narration: SharedNarration.nullable().default(null),
});
export type ShareRequest = z.infer<typeof ShareRequest>;

// One live link, as the dialog and Settings › Shared links read it. contentHash is what the
// reader's copy is compared against to decide whether it has been edited since sharing.
export const Share = z.object({
  token: ShareToken,
  url: z.url(),
  overviewId: OverviewId,
  title: z.string(),
  sharedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  views: z.number().int().nonnegative(),
  contentHash: z.string(),
});
export type Share = z.infer<typeof Share>;

export const Shares = z.object({ shares: z.array(Share) });
export type Shares = z.infer<typeof Shares>;
