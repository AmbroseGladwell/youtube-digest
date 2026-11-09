import { z } from "zod";
import type { OverviewId } from "@overview/domain";

const PLACE_PREFIX = "overview.cookingPlace.";
const HINTS_KEY = "overview.cookingHeadphoneHints";
export const COOKING_PLACE_KEPT_MS = 24 * 60 * 60 * 1000;
export const COOKING_HINT_ENTRIES = 2;

const CookingPlace = z.object({ action: z.number().int().nonnegative(), leftAt: z.number() });
export type CookingPlace = z.infer<typeof CookingPlace>;

// Where the reader left cooking a recipe step by step, kept on this device for a day and cleared
// by Finish (design 150w, owner 3 Nov 2026). Never synced; nothing when it can't be read.
export function readCookingPlace(
  overviewId: OverviewId,
  now = Date.now(),
  storage: Storage = globalThis.localStorage,
): CookingPlace | null {
  try {
    const parsed = CookingPlace.safeParse(JSON.parse(storage.getItem(PLACE_PREFIX + overviewId) ?? "null"));
    if (!parsed.success || now - parsed.data.leftAt > COOKING_PLACE_KEPT_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCookingPlace(overviewId: OverviewId, place: CookingPlace | null, storage: Storage = globalThis.localStorage): void {
  try {
    if (place === null) storage.removeItem(PLACE_PREFIX + overviewId);
    else storage.setItem(PLACE_PREFIX + overviewId, JSON.stringify(place));
  } catch {
    // A device that won't store it starts again from step 1.
  }
}

// The headphones line is shown on the first two entries only (design 150t).
export function readCookingHints(storage: Storage = globalThis.localStorage): number {
  try {
    return z
      .number()
      .int()
      .nonnegative()
      .catch(0)
      .parse(Number(storage.getItem(HINTS_KEY) ?? 0));
  } catch {
    return COOKING_HINT_ENTRIES;
  }
}

export function writeCookingHints(count: number, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(HINTS_KEY, String(count));
  } catch {
    // As above: the line simply shows again.
  }
}
