import { z } from "zod";
import { API_ERROR_CODES } from "./ApiErrorCode.js";
import { RequestId } from "./RequestId.js";
import { QueuedCaptureProblem } from "./QueuedCapture.js";

export const MAX_CLIENT_WARNING_BATCH = 10;

const TranscriptRung = z.enum(["shared-cache", "extension", "service"]);

// What the app did when something it depends on let it down and it carried on anyway: a
// line in the server's logs at warn, never an error-tracking issue and never an event
// (docs/architecture/errors-and-logs.md, "Client warnings"). Every field is an enum, a
// count or an id, so a warning can carry nothing a reader wrote.
export const ClientWarning = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("transcriptFellThrough"),
      // The rungs asked before one answered, or every rung when none did.
      passed: z
        .array(z.object({ rung: TranscriptRung, outcome: z.enum(["unavailable", "no-answer", "failed"]) }).strict())
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
      // The last cycle before signing out ran past its limit, and the reader was signed out
      // anyway, with this much left unsent and refused (docs/features/account-libraries.md).
      pending: z.number().int().nonnegative(),
      stuck: z.number().int().nonnegative(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("playlistCheckFailed"),
      // A followed playlist could not be checked for new videos on opening; the others were
      // (docs/features/playlists.md, "Checking on opening").
      outcome: z.enum(["private", "gone", "failed"]),
      requestId: RequestId.optional(),
      apiErrorCode: z.string().max(64).optional(),
      at: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      name: z.literal("queuedCaptureFailed"),
      // A video the queue took from a followed playlist could not be made, and why, as the
      // reader is told (docs/features/capture-queue.md, "Needs attention").
      problem: QueuedCaptureProblem,
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
export function readClientWarning(sent: ClientWarning): ClientWarning {
  if (sent.name === "narrationFellBack" && sent.apiErrorCode !== undefined && !(sent.apiErrorCode in API_ERROR_CODES)) {
    const { apiErrorCode: _dropped, ...rest } = sent;
    return rest;
  }
  return sent;
}
