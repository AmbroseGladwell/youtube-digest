import { z } from "zod";
import { NoteKind } from "./NoteKind.js";
import { StoredTranscript } from "./StoredTranscript.js";
import { VideoSource } from "./VideoSource.js";

export const VideoReadFailure = z.enum(["not-found", "unavailable"]);
export type VideoReadFailure = z.infer<typeof VideoReadFailure>;

// Keeps the check's one fetch for the overview: docs/features/recipe-notes.md, "Recipe videos".
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
