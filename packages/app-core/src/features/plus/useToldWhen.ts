import { useState } from "react";
import type { PaidPlan } from "./planCards.js";

const STORAGE_KEY = "overview.plus.toldWhen.v1";

const readTold = (): PaidPlan[] => {
  try {
    const held = globalThis.sessionStorage.getItem(STORAGE_KEY);
    return held === null ? [] : (JSON.parse(held) as PaidPlan[]);
  } catch {
    return [];
  }
};

export interface ToldWhen {
  told: readonly PaidPlan[];
  tell: (plan: PaidPlan) => void;
}

// Tell me when is only an event until billing (owner, 25 Nov 2026), so "On the list" lasts the tab's session.
export const useToldWhen = (): ToldWhen => {
  const [told, setTold] = useState<PaidPlan[]>(readTold);
  return {
    told,
    tell: (plan) => {
      const next = told.includes(plan) ? told : [...told, plan];
      setTold(next);
      try {
        globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        return;
      }
    },
  };
};
