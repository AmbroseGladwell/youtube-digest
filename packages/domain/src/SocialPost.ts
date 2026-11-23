import { z } from "zod";
import { TranscriptionOffer } from "./PodcastTranscription.js";
import { StoredTranscript } from "./StoredTranscript.js";

export const SocialPlatform = z.enum(["instagram", "facebook"]);
export type SocialPlatform = z.infer<typeof SocialPlatform>;

export const SOCIAL_PLATFORM_NAME: Record<SocialPlatform, string> = { instagram: "Instagram", facebook: "Facebook" };

// The description is kept whole: on these platforms it often carries the post. Comments are never read (docs/features/social-posts.md).
export const SocialPost = z.object({
  platform: SocialPlatform,
  id: z.string().regex(/^[A-Za-z0-9_-]{5,40}$/),
  url: z.url(),
  handle: z.string().min(1).nullable(),
  authorName: z.string(),
  description: z.string(),
  media: z.enum(["video", "photo", "text"]),
  durationSeconds: z.number().int().positive().nullable(),
  coverUrl: z.url().nullable(),
  postedAt: z.iso.datetime().nullable(),
});
export type SocialPost = z.infer<typeof SocialPost>;

export const SOCIAL_READ_PATH = "/social/read";
export const SOCIAL_TRANSCRIPTION_PATH = "/social/transcription";

export const SocialReadFailure = z.enum(["not-a-post", "unavailable", "blocked", "unreadable", "no-answer"]);
export type SocialReadFailure = z.infer<typeof SocialReadFailure>;

export const SocialRead = z.discriminatedUnion("status", [
  // A video's words when the platform has captions; with none, whether we can transcribe it. A photo has neither.
  z.object({
    status: z.literal("read"),
    post: SocialPost,
    transcript: StoredTranscript.nullable(),
    transcription: TranscriptionOffer.optional(),
  }),
  z.object({ status: z.literal("failed"), reason: SocialReadFailure }),
]);
export type SocialRead = z.infer<typeof SocialRead>;
