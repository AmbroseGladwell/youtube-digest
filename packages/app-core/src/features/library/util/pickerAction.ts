import type { BulkAction } from "./bulkActionToast.js";

export interface PickerChange {
  place: string;
  heldBefore: number;
  given: boolean;
}

export const pickerAction = (changes: Iterable<PickerChange>, overviews: number, noun: "project" | "topic"): BulkAction | null => {
  const real = [...changes].filter(({ heldBefore, given }) => (given ? heldBefore < overviews : heldBefore > 0));
  if (real.length === 0) {
    return null;
  }
  if (real.length > 1) {
    return { kind: "updated", places: real.length, noun };
  }
  const [only] = real as [PickerChange];
  return { kind: only.given ? "added" : "removed", overviews, place: only.place };
};
