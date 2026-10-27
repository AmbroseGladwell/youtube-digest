import { z } from "zod";
import { QueueHold } from "./types/QueueHold.js";
import { localDayKey } from "./util/madeTodayByPlaylist.js";

const NO_ACCOUNT = "noAccount";

export const CaptureQueuePreferences = z.object({
  paused: z.boolean().catch(false),
  folded: z.boolean().catch(false),
  hold: QueueHold.nullable().catch(null),
  // The videos the reader chose to make now that were made today, so they stay off their
  // playlist's pace (docs/features/capture-queue.md, "Waiting on a pace").
  chosenToday: z.object({ day: z.string(), videoIds: z.array(z.string()) }).nullable().catch(null),
});
export type CaptureQueuePreferences = z.infer<typeof CaptureQueuePreferences>;

export const DEFAULT_CAPTURE_QUEUE_PREFERENCES: CaptureQueuePreferences = { paused: false, folded: false, hold: null, chosenToday: null };

const storageKey = (accountId: string | null) => `overview.captureQueue.${accountId ?? NO_ACCOUNT}`;

// Paused, folded into the strip, waiting at a limit and what was chosen today are this
// device's own, kept per account and never synced. A hold whose time has passed, or an
// earlier day's choices, are not read back (docs/features/capture-queue.md).
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
    const { hold, chosenToday } = parsed.data;
    return {
      ...parsed.data,
      hold: hold !== null && hold.resumesAt > now.getTime() ? hold : null,
      chosenToday: chosenToday !== null && chosenToday.day === localDayKey(now) ? chosenToday : null,
    };
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
