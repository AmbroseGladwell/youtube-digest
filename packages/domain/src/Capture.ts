import { z } from "zod";
import { OverviewId, SourceKey } from "./Brands.js";
import { FeedOrigin } from "./FeedOrigin.js";
import { PlaylistOrigin } from "./PlaylistOrigin.js";
import { QueuedCaptureProblem, QueuedCaptureStatus } from "./QueuedCapture.js";
import { Source } from "./Source.js";

export const CAPTURES_PATH = "/captures";
export const CAPTURE_CLAIMS_PATH = "/capture-claims";

export const CaptureWait = z.enum(["turn", "server", "extension", "reset"]);
export type CaptureWait = z.infer<typeof CaptureWait>;

export const CaptureSurface = z.enum(["web", "phone", "panel", "playlist", "feed"]);
export type CaptureSurface = z.infer<typeof CaptureSurface>;

const CaptureBase = z.object({
  id: OverviewId,
  sourceKey: SourceKey,
  url: z.url(),
  keptAt: z.iso.datetime(),
  keptFrom: CaptureSurface,
  captureReason: z.string().nullable(),
  title: z.string().nullable().catch(null),
  thumbnailUrl: z.url().nullable().catch(null),
  // Playlist videos only: docs/features/capture-queue.md, "One at a time, in the playlist's order".
  fromPlaylist: PlaylistOrigin.nullable().catch(null),
  addedAt: z.iso.datetime().nullable().catch(null),
  playlistIndex: z.number().int().nonnegative().nullable().catch(null),
  chosenAt: z.iso.datetime().nullable().catch(null),
  // Feed entries only: docs/features/followed-feeds.md, "Entries".
  fromFeed: FeedOrigin.nullish().catch(null),
});

export const KeptCapture = CaptureBase.extend({
  stage: z.literal("kept"),
  source: Source.nullable(),
  waitingFor: CaptureWait,
  resumesAt: z.iso.datetime().nullable(),
  queueStatus: QueuedCaptureStatus.catch("waiting"),
  problem: QueuedCaptureProblem.nullable().catch(null),
});
export type KeptCapture = z.infer<typeof KeptCapture>;

export const SavedCapture = CaptureBase.extend({
  stage: z.literal("saved"),
  source: Source,
  savedAt: z.iso.datetime(),
  // The description, show notes or caption its overview is written with (docs/features/kept-links.md).
  notes: z.string().nullable().catch(null),
});
export type SavedCapture = z.infer<typeof SavedCapture>;

// A source before its overview, under the id the overview will take (docs/features/kept-links.md).
export const Capture = z.discriminatedUnion("stage", [KeptCapture, SavedCapture]);
export type Capture = z.infer<typeof Capture>;
