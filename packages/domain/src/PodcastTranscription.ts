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

// The month's transcribing for an account, in seconds of audio, and the episodes it went on.
export const TranscriptionUsage = z.object({
  usedSeconds: z.number().int().min(0),
  limitSeconds: z.number().int().min(0),
  episodes: z.number().int().min(0),
});
export type TranscriptionUsage = z.infer<typeof TranscriptionUsage>;

// What transcribing an episode with no words would mean for this reader, said before they choose:
// `needed` within the month's hours, `not-enough` past them, `free` when it was transcribed for
// them in the last day or is on its way, `too-long` past the longest episode, `no-audio` with no
// enclosure, and `unavailable` where this server doesn't transcribe (docs/features/speech-to-text.md).
export const TranscriptionOffer = z.discriminatedUnion("status", [
  z.object({ status: z.literal("needed"), episodeSeconds: z.number().nonnegative().nullable(), usage: TranscriptionUsage }),
  z.object({ status: z.literal("not-enough"), episodeSeconds: z.number().nonnegative().nullable(), usage: TranscriptionUsage }),
  z.object({ status: z.literal("free"), why: z.enum(["transcribed", "on-its-way"]) }),
  z.object({ status: z.literal("too-long"), episodeSeconds: z.number().nonnegative() }),
  z.object({ status: z.literal("no-audio") }),
  z.object({ status: z.literal("unavailable") }),
]);
export type TranscriptionOffer = z.infer<typeof TranscriptionOffer>;

// Whether an episode's words can be found, asked when its link is read and before Create: `found`
// on a rung that costs nothing to name, `none` with what transcribing would take, `unknown` when a
// rung couldn't be asked, so Create looks again (designs 305c, 305c-2). No words are fetched.
export const TranscriptCheck = z.discriminatedUnion("words", [
  z.object({ words: z.literal("found") }),
  z.object({ words: z.literal("none"), transcription: TranscriptionOffer }),
  z.object({ words: z.literal("unknown") }),
]);
export type TranscriptCheck = z.infer<typeof TranscriptCheck>;
