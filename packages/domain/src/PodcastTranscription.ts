import { z } from "zod";
import { StoredTranscript } from "./StoredTranscript.js";

// docs/features/speech-to-text.md.
export const TranscriptionFailure = z.enum(["no-transcriber", "too-long", "audio-unreachable", "audio-unreadable", "no-speech", "failed"]);
export type TranscriptionFailure = z.infer<typeof TranscriptionFailure>;

// Told apart, since only transcribing is the minute the words take.
export const PodcastTranscription = z.discriminatedUnion("status", [
  z.object({ status: z.literal("waiting"), id: z.uuid(), episodeSeconds: z.number().nonnegative().nullable() }),
  z.object({ status: z.literal("transcribing"), id: z.uuid(), episodeSeconds: z.number().nonnegative().nullable() }),
  z.object({ status: z.literal("ready"), id: z.uuid(), transcript: StoredTranscript }),
  z.object({ status: z.literal("failed"), id: z.uuid(), reason: TranscriptionFailure }),
]);
export type PodcastTranscription = z.infer<typeof PodcastTranscription>;

// Seconds of audio this month, and the episodes it went on.
export const TranscriptionUsage = z.object({
  usedSeconds: z.number().int().min(0),
  limitSeconds: z.number().int().min(0),
  episodes: z.number().int().min(0),
});
export type TranscriptionUsage = z.infer<typeof TranscriptionUsage>;

// Said before the reader chooses (docs/features/speech-to-text.md).
export const TranscriptionOffer = z.discriminatedUnion("status", [
  z.object({ status: z.literal("needed"), episodeSeconds: z.number().nonnegative().nullable(), usage: TranscriptionUsage }),
  z.object({ status: z.literal("not-enough"), episodeSeconds: z.number().nonnegative().nullable(), usage: TranscriptionUsage }),
  z.object({ status: z.literal("free"), why: z.enum(["transcribed", "on-its-way"]) }),
  z.object({ status: z.literal("too-long"), episodeSeconds: z.number().nonnegative() }),
  z.object({ status: z.literal("no-audio") }),
  z.object({ status: z.literal("unavailable") }),
]);
export type TranscriptionOffer = z.infer<typeof TranscriptionOffer>;

// Asked when the link is read, fetching no words; unknown means Create looks again (designs 305c, 305c-2).
export const TranscriptCheck = z.discriminatedUnion("words", [
  z.object({ words: z.literal("found") }),
  z.object({ words: z.literal("none"), transcription: TranscriptionOffer }),
  z.object({ words: z.literal("unknown") }),
]);
export type TranscriptCheck = z.infer<typeof TranscriptCheck>;
