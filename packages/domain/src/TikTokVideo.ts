import { z } from "zod";
import { StoredTranscript } from "./StoredTranscript.js";

export const TikTokCaptionTrack = z.object({
  language: z.string().min(1),
  source: z.string().min(1),
});
export type TikTokCaptionTrack = z.infer<typeof TikTokCaptionTrack>;

// docs/features/tiktok-links.md
export const TikTokVideo = z.object({
  id: z.string().regex(/^\d{8,25}$/),
  url: z.url(),
  handle: z.string().min(1),
  authorName: z.string(),
  description: z.string(),
  durationSeconds: z.number().int().positive().nullable(),
  coverUrl: z.url().nullable(),
  postedAt: z.iso.datetime().nullable(),
  captions: z.array(TikTokCaptionTrack),
});
export type TikTokVideo = z.infer<typeof TikTokVideo>;

export const TIKTOK_READ_PATH = "/tiktok/read";

export const TikTokReadFailure = z.enum(["not-a-video", "unavailable", "blocked", "unreadable", "no-answer"]);
export type TikTokReadFailure = z.infer<typeof TikTokReadFailure>;

export const TikTokRead = z.discriminatedUnion("status", [
  // The words come in the same call for the same credit; null when the video has no captions.
  z.object({ status: z.literal("read"), video: TikTokVideo, transcript: StoredTranscript.nullable() }),
  z.object({ status: z.literal("failed"), reason: TikTokReadFailure }),
]);
export type TikTokRead = z.infer<typeof TikTokRead>;
