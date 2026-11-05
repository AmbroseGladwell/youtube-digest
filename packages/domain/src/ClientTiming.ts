import { z } from "zod";

export const MAX_CLIENT_TIMING_BATCH = 10;
export const MAX_CAPTURE_STEPS = 6;

// Each thing a capture waits on, in the order it happens: the local store, then the
// transcript ladder's rungs, then the model, then the save (docs/features/transcript-retrieval.md).
export const CaptureStep = z.enum(["stored", "shared-cache", "extension", "service", "model", "save"]);
export type CaptureStep = z.infer<typeof CaptureStep>;

export const CaptureStepOutcome = z.enum(["answered", "no-answer", "unavailable", "failed"]);
export type CaptureStepOutcome = z.infer<typeof CaptureStepOutcome>;

export const CaptureOutcome = z.enum(["finished", "failed", "cancelled"]);
export type CaptureOutcome = z.infer<typeof CaptureOutcome>;

const Milliseconds = z.number().int().min(0).max(24 * 60 * 60 * 1000);

export const CaptureTimedStep = z.object({ step: CaptureStep, outcome: CaptureStepOutcome, ms: Milliseconds }).strict();
export type CaptureTimedStep = z.infer<typeof CaptureTimedStep>;

// How the time went for one thing the app did, measured on the device and logged by the
// server at info: never an event, never an issue (docs/architecture/errors-and-logs.md,
// "Client timings"). Enums, counts and ids only, as a warning is.
const captureTimed = <Step extends z.ZodType>(step: Step) =>
  z
    .object({
      name: z.literal("captureTimed"),
      outcome: CaptureOutcome,
      // Only the steps that were asked: one never reached has no entry, not a zero.
      steps: z.array(step).max(MAX_CAPTURE_STEPS),
      totalMs: Milliseconds,
      transcriptCharacters: z.number().int().min(0).max(10_000_000),
      at: z.iso.datetime(),
    })
    .strict();

export const ClientTiming = z.discriminatedUnion("name", [captureTimed(CaptureTimedStep)]);
export type ClientTiming = z.infer<typeof ClientTiming>;
export type ClientTimingName = ClientTiming["name"];

// A timing as the app hands it over: the reporter stamps the time.
export type ClientTimingReport = {
  [Name in ClientTimingName]: Omit<Extract<ClientTiming, { name: Name }>, "at">;
}[ClientTimingName];

// On the wire a step is named loosely, so a server behind the app drops a step it doesn't
// know rather than refusing the whole batch.
const SentCaptureStep = z.object({ step: z.string().max(32), outcome: z.string().max(32), ms: Milliseconds }).strict();
export const SentClientTiming = z.discriminatedUnion("name", [captureTimed(SentCaptureStep)]);
export type SentClientTiming = z.infer<typeof SentClientTiming>;

const isKnownStep = (sent: z.infer<typeof SentCaptureStep>): sent is CaptureTimedStep =>
  CaptureStep.safeParse(sent.step).success && CaptureStepOutcome.safeParse(sent.outcome).success;

// A step or outcome the API doesn't have is dropped rather than logged as sent, the way
// readClientWarning drops a code it doesn't know.
export function readClientTiming(sent: SentClientTiming): ClientTiming {
  return { ...sent, steps: sent.steps.filter(isKnownStep) };
}
