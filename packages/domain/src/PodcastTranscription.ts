import { z } from "zod";
import { StoredTranscript } from "./StoredTranscript.js";

// `no-transcriber`: no GPU started within the wait a reader is given; `too-long`: past the longest
// episode transcribed; `audio-unreachable`/`audio-unreadable`: the feed's audio couldn't be fetched
// or decoded; `no-speech`: nothing in it was heard as words (docs/features/speech-to-text.md).
export const TranscriptionFailure = z.enum(["no-transcriber", "too-long", "audio-unreachable", "audio-unreadable", "no-speech", "failed"]);
export type TranscriptionFailure = z.infer<typeof TranscriptionFailure>;

// `waiting` until a GPU has started on the episode, then `transcribing`: the two a reader is told
// apart, since only the second is the minute the words take.
export const PodcastTranscription = z.discriminatedUnion("status", [
  z.object({ status: z.literal("waiting"), id: z.uuid(), episodeSeconds: z.number().nonnegative().nullable() }),
  z.object({ status: z.literal("transcribing"), id: z.uuid(), episodeSeconds: z.number().nonnegative().nullable() }),
  z.object({ status: z.literal("ready"), id: z.uuid(), transcript: StoredTranscript }),
  z.object({ status: z.literal("failed"), id: z.uuid(), reason: TranscriptionFailure }),
]);
export type PodcastTranscription = z.infer<typeof PodcastTranscription>;
