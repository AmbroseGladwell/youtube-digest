export const TRANSCRIPT_MOMENT_STATE = "transcriptMoment";

export const transcriptMomentFromLocation = (state: unknown): number | null => {
  if (typeof state !== "object" || state === null) {
    return null;
  }
  const moment = (state as Record<string, unknown>)[TRANSCRIPT_MOMENT_STATE];
  return typeof moment === "number" && Number.isInteger(moment) && moment >= 0 ? moment : null;
};
