import { z } from "zod";
import { NoteKind } from "./NoteKind.js";
import { StoredTranscript } from "./StoredTranscript.js";
import { VideoSource } from "./VideoSource.js";

export const VideoReadFailure = z.enum(["not-found", "unavailable"]);
export type VideoReadFailure = z.infer<typeof VideoReadFailure>;

// The card, and where it could be checked, the video's kind and the transcript the check was
// made from, so the device keeps that one fetch for the overview (docs/features/onboarding.md,
// "The recipe video check"). Null where the check didn't run: the video note's own check decides.
export const VideoRead = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("read"),
    video: VideoSource,
    noteKind: NoteKind.nullable().default(null),
    transcript: StoredTranscript.nullable().default(null),
  }),
  z.object({ status: z.literal("failed"), reason: VideoReadFailure }),
]);
export type VideoRead = z.infer<typeof VideoRead>;
