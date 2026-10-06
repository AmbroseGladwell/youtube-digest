import { z } from "zod";
import { QueueHold } from "./types/QueueHold.js";

const NO_ACCOUNT = "noAccount";

export const CaptureQueuePreferences = z.object({
  paused: z.boolean().catch(false),
  folded: z.boolean().catch(false),
  hold: QueueHold.nullable().catch(null),
});
export type CaptureQueuePreferences = z.infer<typeof CaptureQueuePreferences>;

export const DEFAULT_CAPTURE_QUEUE_PREFERENCES: CaptureQueuePreferences = { paused: false, folded: false, hold: null };

const storageKey = (accountId: string | null) => `overview.captureQueue.${accountId ?? NO_ACCOUNT}`;

// Paused, folded into the strip, and waiting at a limit are this device's own, kept per
// account and never synced. A hold whose time has passed is not read back
// (docs/features/capture-queue.md).
export function readCaptureQueuePreferences(
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
  now: Date = new Date(),
): CaptureQueuePreferences {
  try {
    const raw = storage.getItem(storageKey(accountId));
    if (!raw) return DEFAULT_CAPTURE_QUEUE_PREFERENCES;
    const parsed = CaptureQueuePreferences.safeParse(JSON.parse(raw));
    if (!parsed.success) return DEFAULT_CAPTURE_QUEUE_PREFERENCES;
    const { hold } = parsed.data;
    return { ...parsed.data, hold: hold !== null && hold.resumesAt > now.getTime() ? hold : null };
  } catch {
    return DEFAULT_CAPTURE_QUEUE_PREFERENCES;
  }
}

export function writeCaptureQueuePreferences(
  accountId: string | null,
  preferences: CaptureQueuePreferences,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    storage.setItem(storageKey(accountId), JSON.stringify(preferences));
  } catch {
    return;
  }
}
