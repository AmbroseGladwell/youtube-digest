import { z } from "zod";
import { AuthIntent, OnboardingStep, OverviewId, SharedOverview, ShareToken, SourceKey } from "@overview/domain";
import { extractYouTubeVideoId } from "../newOverview/util/parseYouTubeUrl.js";

// Progress from before any kind of link was taken held the video's address instead of its key.
const keyedBySource = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null || "sourceKey" in raw || !("videoUrl" in raw)) {
    return raw;
  }
  const { videoUrl, ...rest } = raw as { videoUrl: unknown };
  return { ...rest, sourceKey: typeof videoUrl === "string" ? extractYouTubeVideoId(videoUrl) : null };
};

// Steps from before OV-327's screens, carried to the nearest screen that's left.
const STEPS_SINCE_GONE: Record<string, OnboardingStep> = {
  library: "knowledgeBase",
  voice: "account",
  askYourAi: "account",
  moreSources: "account",
  plan: "wait",
};
const onTodaysStep = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null || !("step" in raw)) {
    return raw;
  }
  const step = (raw as { step: unknown }).step;
  return typeof step === "string" && step in STEPS_SINCE_GONE ? { ...raw, step: STEPS_SINCE_GONE[step] } : raw;
};

const OnboardingProgressShape = z.object({
  // The key is of what's made from the link, once known: a playlist's chosen video, say.
  link: z.string(),
  sourceKey: SourceKey.nullable(),
  tabId: z.number().int().nullable().catch(null),
  step: OnboardingStep,
  // Kept so going back shows them; the topics are made on Continue.
  topics: z.array(z.string()).catch([]),
  // Writing waits until About you is answered or skipped, or the reader leaves the questions.
  mayWrite: z.boolean(),
  overviewId: OverviewId.nullable(),
  // docs/features/onboarding.md, "The run lives in one tab".
  runner: z.string().nullable().catch(null),
  way: AuthIntent.nullable(),
  // Kept so a page that comes back counts each once: docs/features/onboarding.md, "Analytics".
  landed: z
    .object({ at: z.number(), overview: z.enum(["ready", "writing", "failed"]), arrived: z.boolean() })
    .nullable()
    .catch(null),
  // Already made, so nothing is generated: docs/features/onboarding.md, "From a shared page".
  share: z
    .object({ token: ShareToken, snapshot: SharedOverview, sample: z.boolean().catch(false) })
    .nullable()
    .catch(null),
});
export const OnboardingProgress = z.preprocess((raw) => onTodaysStep(keyedBySource(raw)), OnboardingProgressShape);
export type OnboardingProgress = z.infer<typeof OnboardingProgressShape>;

export const ONBOARDING_PROGRESS_STORAGE_KEY = "overview.onboarding.v1";
const STORAGE_KEY = ONBOARDING_PROGRESS_STORAGE_KEY;

export const readOnboardingProgress = (storage: Storage = globalThis.localStorage): OnboardingProgress | null => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = OnboardingProgress.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const writeOnboardingProgress = (progress: OnboardingProgress | null, storage: Storage = globalThis.localStorage): void => {
  try {
    if (progress === null) {
      storage.removeItem(STORAGE_KEY);
    } else {
      storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  } catch {
    return;
  }
};

export const isOnboardingProgressKey = (key: string | null): boolean => key === STORAGE_KEY;
