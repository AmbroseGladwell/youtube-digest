// What a typed reason becomes on the record: trimmed, and null rather than "" when
// there is nothing there, so that "no reason" is one value everywhere it is read.
export const captureReasonFromDraft = (draft: string): string | null => {
  const trimmed = draft.trim();
  return trimmed === "" ? null : trimmed;
};
