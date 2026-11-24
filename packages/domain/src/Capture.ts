import { z } from "zod";
import { OverviewId, SourceKey } from "./Brands.js";
import { Source } from "./Source.js";

export const CAPTURES_PATH = "/captures";

export const CaptureWait = z.enum(["server", "extension", "reset"]);
export type CaptureWait = z.infer<typeof CaptureWait>;

export const CaptureSurface = z.enum(["web", "phone", "panel"]);
export type CaptureSurface = z.infer<typeof CaptureSurface>;

const CaptureBase = z.object({
  id: OverviewId,
  sourceKey: SourceKey,
  url: z.url(),
  keptAt: z.iso.datetime(),
  keptFrom: CaptureSurface,
  captureReason: z.string().nullable(),
});

export const KeptCapture = CaptureBase.extend({
  stage: z.literal("kept"),
  source: Source.nullable(),
  waitingFor: CaptureWait,
  resumesAt: z.iso.datetime().nullable(),
});
export type KeptCapture = z.infer<typeof KeptCapture>;

export const SavedCapture = CaptureBase.extend({
  stage: z.literal("saved"),
  source: Source,
  savedAt: z.iso.datetime(),
});
export type SavedCapture = z.infer<typeof SavedCapture>;

// A source before its overview, under the id the overview will take (docs/features/kept-links.md).
export const Capture = z.discriminatedUnion("stage", [KeptCapture, SavedCapture]);
export type Capture = z.infer<typeof Capture>;
