import { z } from "zod";
import { QueueHold } from "./types/QueueHold.js";
import { localDayKey } from "./util/madeTodayByPlaylist.js";

const NO_ACCOUNT = "noAccount";

export const CaptureQueuePreferences = z.object({
  paused: z.boolean().catch(false),
  folded: z.boolean().catch(false),
  hold: QueueHold.nullable().catch(null),
  // Why chosen videos stay off the pace: docs/features/capture-queue.md, "Making waiting videos now".
  chosenToday: z
    .object({ day: z.string(), videoIds: z.array(z.string()) })
    .nullable()
    .catch(null),
});
export type CaptureQueuePreferences = z.infer<typeof CaptureQueuePreferences>;

export const DEFAULT_CAPTURE_QUEUE_PREFERENCES: CaptureQueuePreferences = { paused: false, folded: false, hold: null, chosenToday: null };

const storageKey = (accountId: string | null) => `overview.captureQueue.${accountId ?? NO_ACCOUNT}`;

// Device-only and per account: docs/features/capture-queue.md, "On this device, for now".
export const readCaptureQueuePreferences = (
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
  now: Date = new Date(),
): CaptureQueuePreferences => {
  try {
    const raw = storage.getItem(storageKey(accountId));
    if (!raw) {
      return DEFAULT_CAPTURE_QUEUE_PREFERENCES;
    }
    const parsed = CaptureQueuePreferences.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return DEFAULT_CAPTURE_QUEUE_PREFERENCES;
    }
    const { hold, chosenToday } = parsed.data;
    return {
      ...parsed.data,
      hold: hold !== null && hold.resumesAt > now.getTime() ? hold : null,
      chosenToday: chosenToday !== null && chosenToday.day === localDayKey(now) ? chosenToday : null,
    };
  } catch {
    return DEFAULT_CAPTURE_QUEUE_PREFERENCES;
  }
};

export const writeCaptureQueuePreferences = (
  accountId: string | null,
  preferences: CaptureQueuePreferences,
  storage: Storage = globalThis.localStorage,
): void => {
  try {
    storage.setItem(storageKey(accountId), JSON.stringify(preferences));
  } catch {
    return;
  }
};

export const forgetCaptureQueuePreferences = (accountId: string, storage: Storage = globalThis.localStorage): void => {
  try {
    storage.removeItem(storageKey(accountId));
  } catch {
    return;
  }
};
