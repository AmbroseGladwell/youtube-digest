import { z } from "zod";
import { API_ERROR_CODES } from "./ApiErrorCode.js";
import { RequestId } from "./RequestId.js";
import { QueuedCaptureProblem } from "./QueuedCapture.js";
import { ModelId } from "./ModelId.js";
import { PlaylistPace } from "./PlaylistPace.js";
import { Provider } from "./Provider.js";

export const MAX_CLIENT_WARNING_BATCH = 10;

const TranscriptRung = z.enum(["shared-cache", "extension", "service"]);
// TranscriptFetchFailure's names, so a rung's failure reads without the transcripts package.
const TranscriptRungFailure = z.enum([
  "no-captions",
  "video-unavailable",
  "access-restricted",
  "source-blocked",
  "rate-limited",
  "source-unavailable",
  "malformed-response",
  "source-unsupported",
  "budget-exhausted",
  "daily-cap",
]);
// docs/features/capture-queue.md, "Waiting at a limit".
const QueueHoldReason = z.enum(["serverCap", "serverBusy", "monthSpent"]);

// Logged at warn, never an issue or event: docs/architecture/errors-and-logs.md, "Client warnings".
export const ClientWarning = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("transcriptFellThrough"),
      // The rungs asked before one answered, or all of them, each with its reason when named.
      passed: z
        .array(
          z
            .object({
              rung: TranscriptRung,
              outcome: z.enum(["unavailable", "no-answer", "failed"]),
              failure: TranscriptRungFailure.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(4),
      answeredBy: TranscriptRung.nullable(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("narrationFellBack"),
      // Why the player moved to the pacer instead of the narrated audio.
      reason: z.enum(["renderFailed", "requestFailed"]),
      requestId: RequestId.optional(),
      apiErrorCode: z.string().max(64).optional(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("signOutSyncGaveUp"),
      // Signed out anyway with this much unsent and refused (docs/features/account-libraries.md).
      pending: z.number().int().nonnegative(),
      stuck: z.number().int().nonnegative(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("playlistCheckFailed"),
      // docs/features/playlists.md, "Checking on opening".
      outcome: z.enum(["private", "gone", "failed"]),
      requestId: RequestId.optional(),
      apiErrorCode: z.string().max(64).optional(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("queuedCaptureFailed"),
      // docs/features/capture-queue.md, "Needs attention".
      problem: QueuedCaptureProblem,
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("captureQueueHeld"),
      // docs/features/capture-queue.md, "Waiting at a limit".
      reason: QueueHoldReason,
      waiting: z.number().int().nonnegative(),
      resumesInSeconds: z.number().int().nonnegative(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("captureQueueResumed"),
      // The limit reset, the extension could fetch instead, or a key or plan gave the month more room.
      reason: QueueHoldReason,
      waiting: z.number().int().nonnegative(),
      via: z.enum(["reset", "extension", "key", "plan"]),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("chosenModelFailed"),
      // The reader's own model refused, or broke the schema after its retry (OV-247).
      provider: Provider,
      model: ModelId,
      reason: z.enum(["refused", "schema"]),
      status: z.number().int().min(400).max(499).optional(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("captureQueuePaced"),
      // docs/features/capture-queue.md, "Waiting on a pace".
      pace: PlaylistPace,
      madeToday: z.number().int().nonnegative(),
      waiting: z.number().int().nonnegative(),
      at: z.iso.datetime(),
    })
    .strict(),
]);
export type ClientWarning = z.infer<typeof ClientWarning>;
export type ClientWarningName = ClientWarning["name"];

// A warning as the app hands it over: the reporter stamps the time.
export type ClientWarningReport = {
  [Name in ClientWarningName]: Omit<Extract<ClientWarning, { name: Name }>, "at">;
}[ClientWarningName];

// A code the API doesn't have is dropped rather than logged as sent.
export const readClientWarning = (sent: ClientWarning): ClientWarning => {
  if (sent.name === "narrationFellBack" && sent.apiErrorCode !== undefined && !(sent.apiErrorCode in API_ERROR_CODES)) {
    const { apiErrorCode: _dropped, ...rest } = sent;
    return rest;
  }
  return sent;
};
