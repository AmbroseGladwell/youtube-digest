export const captureReasonFromDraft = (draft: string): string | null => {
  const trimmed = draft.trim();
  return trimmed === "" ? null : trimmed;
};
