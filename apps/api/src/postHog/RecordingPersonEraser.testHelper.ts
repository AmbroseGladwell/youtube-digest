import type { PersonEraser } from "./PersonEraser.js";

export interface RecordingPersonEraser extends PersonEraser {
  erased: string[];
  absent: Set<string>;
  failing: boolean;
}

export const makeRecordingPersonEraser = (): RecordingPersonEraser => {
  const eraser: RecordingPersonEraser = {
    erased: [],
    absent: new Set(),
    failing: false,
    erase: async (distinctId) => {
      if (eraser.failing) {
        throw new Error("Simulated: PostHog is down");
      }
      eraser.erased.push(distinctId);
      return eraser.absent.has(distinctId) ? "absent" : "queued";
    },
  };
  return eraser;
};
