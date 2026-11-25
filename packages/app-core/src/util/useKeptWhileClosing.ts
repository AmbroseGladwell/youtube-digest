import { useState } from "react";

export interface KeptWhileClosing<T> {
  open: boolean;
  kept: T | null;
}

// A sheet opened by a value (null when shut) keeps that value while it animates out: docs/features/bottom-sheets.md.
export const useKeptWhileClosing = <T>(value: T | null): KeptWhileClosing<T> => {
  const [kept, setKept] = useState<T | null>(value);
  if (value !== null && value !== kept) {
    setKept(value);
  }
  return { open: value !== null, kept: value ?? kept };
};
