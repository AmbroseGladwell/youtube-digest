import { z } from "zod";
import { AuthIntent, OnboardingStep, OverviewId, SharedOverview, ShareToken, SourceKey } from "@overview/domain";
import { extractYouTubeVideoId } from "../newOverview/util/parseYouTubeUrl.js";

// Progress from before any kind of link was taken held the video's address instead of its key.
const keyedBySource = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null || "sourceKey" in raw || !("videoUrl" in raw)) return raw;
  const { videoUrl, ...rest } = raw as { videoUrl: unknown };
  return { ...rest, sourceKey: typeof videoUrl === "string" ? extractYouTubeVideoId(videoUrl) : null };
};

const OnboardingProgressShape = z.object({
  // What the reader gave Start, and what is being made from it once that's known: the link's
  // own video, the playlist video they chose, or the article it was read as.
  link: z.string(),
  sourceKey: SourceKey.nullable(),
  // The panel's tab the link came from, read in the browser rather than by our server.
  tabId: z.number().int().nullable().catch(null),
  step: OnboardingStep,
  // The topics chosen, so going back to the screen shows them; made on Continue.
  topics: z.array(z.string()).catch([]),
  // Writing waits until About you is answered or skipped, or the reader leaves the questions.
  mayWrite: z.boolean(),
  overviewId: OverviewId.nullable(),
  way: AuthIntent.nullable(),
  // A copy saved from a shared page is the first overview, so nothing is made: it goes into
  // the account once there is one, let in uncounted through its link
  // (docs/features/onboarding.md, "From a shared page").
  share: z.object({ token: ShareToken, snapshot: SharedOverview }).nullable().catch(null),
});
export const OnboardingProgress = z.preprocess(keyedBySource, OnboardingProgressShape);
export type OnboardingProgress = z.infer<typeof OnboardingProgressShape>;

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
