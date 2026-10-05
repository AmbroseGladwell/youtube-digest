import { z } from "zod";

const NO_ACCOUNT = "noAccount";

export const CaptureQueuePreferences = z.object({
  paused: z.boolean().catch(false),
  folded: z.boolean().catch(false),
});
export type CaptureQueuePreferences = z.infer<typeof CaptureQueuePreferences>;

export const DEFAULT_CAPTURE_QUEUE_PREFERENCES: CaptureQueuePreferences = { paused: false, folded: false };

const storageKey = (accountId: string | null) => `overview.captureQueue.${accountId ?? NO_ACCOUNT}`;

// Paused, and folded into the strip, are this device's choices about its own queue, kept per
// account and never synced (docs/features/capture-queue.md).
export function readCaptureQueuePreferences(
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
): CaptureQueuePreferences {
  try {
    const raw = storage.getItem(storageKey(accountId));
    if (!raw) return DEFAULT_CAPTURE_QUEUE_PREFERENCES;
    const parsed = CaptureQueuePreferences.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_CAPTURE_QUEUE_PREFERENCES;
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
