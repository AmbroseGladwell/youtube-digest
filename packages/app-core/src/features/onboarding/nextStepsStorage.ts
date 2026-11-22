import { z } from "zod";
import { OverviewId } from "@overview/domain";

export const NextStep = z.enum(["own", "extension", "ai"]);
export type NextStep = z.infer<typeof NextStep>;

export const NextSteps = z.object({
  overviewId: OverviewId,
  dismissed: z.array(NextStep).catch([]),
  sample: z.boolean().catch(false),
});
export type NextSteps = z.infer<typeof NextSteps>;

const STORAGE_KEY = "overview.nextSteps.v1";

// The device's own, since the steps follow the reveal it saw.
export const readNextSteps = (storage: Storage = globalThis.localStorage): NextSteps | null => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = NextSteps.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const writeNextSteps = (nextSteps: NextSteps, storage: Storage = globalThis.localStorage): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(nextSteps));
  } catch {
    return;
  }
};

export const isRevealedSample = (overviewId: string | null): boolean => {
  const held = readNextSteps();
  return overviewId !== null && held !== null && held.overviewId === overviewId && held.sample;
};
