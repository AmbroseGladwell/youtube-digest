import { z } from "zod";
import { OverviewId } from "@overview/domain";

export const NextStep = z.enum(["extension", "ai"]);
export type NextStep = z.infer<typeof NextStep>;

export const NextSteps = z.object({
  overviewId: OverviewId,
  dismissed: z.array(NextStep).catch([]),
});
export type NextSteps = z.infer<typeof NextSteps>;

const STORAGE_KEY = "overview.nextSteps.v1";

// The next steps under onboarding's overview, and which of them were dismissed: this device's
// own, since they follow the reveal it saw (docs/features/onboarding.md, "The reveal").
export function readNextSteps(storage: Storage = globalThis.localStorage): NextSteps | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = NextSteps.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeNextSteps(nextSteps: NextSteps, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(nextSteps));
  } catch {
    return;
  }
}
