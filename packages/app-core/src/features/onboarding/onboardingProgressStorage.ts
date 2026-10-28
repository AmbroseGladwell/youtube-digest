import { z } from "zod";
import { AuthIntent, OnboardingStep, OverviewId } from "@overview/domain";

export const OnboardingProgress = z.object({
  // What the reader gave the home page, and the video being made from it: the same link,
  // or the playlist video they chose.
  link: z.string(),
  videoUrl: z.string().nullable(),
  step: OnboardingStep,
  // The topics chosen, so going back to the screen shows them; made on Continue.
  topics: z.array(z.string()).catch([]),
  // Writing waits until About you is answered or skipped, or the reader leaves the questions.
  mayWrite: z.boolean(),
  overviewId: OverviewId.nullable(),
  way: AuthIntent.nullable(),
});
export type OnboardingProgress = z.infer<typeof OnboardingProgress>;

const STORAGE_KEY = "overview.onboarding.v1";

// Where this device is in onboarding, so a reload or the sign-in link opened in another tab
// picks up at the same screen. The device's own, before there is an account to keep it on
// (docs/features/onboarding.md, "Leaving and coming back").
export function readOnboardingProgress(storage: Storage = globalThis.localStorage): OnboardingProgress | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = OnboardingProgress.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeOnboardingProgress(
  progress: OnboardingProgress | null,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    if (progress === null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    return;
  }
}

export const isOnboardingProgressKey = (key: string | null): boolean => key === STORAGE_KEY;
