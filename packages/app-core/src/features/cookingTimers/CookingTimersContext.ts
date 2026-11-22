import { createContext, useContext } from "react";
import type { OverviewPageEvents } from "@overview/domain";
import type { EventMethod } from "../analytics/createAnalytics.js";
import type { CookingTimer, CookingTimerSource, CookingTimerStart } from "../reader/util/cookingTimers.js";

export type CookingTimerEvents = {
  [A in keyof OverviewPageEvents["cooking"]]: EventMethod<OverviewPageEvents["cooking"][A]>;
};

export type CookingTimerEnd = "dismissed" | "cancelled" | "left" | "signedOut" | "leftPage";

export interface CookRequest {
  recipe: string;
  action: number;
  actionText: string;
}

export interface CookingTimers {
  scope: "reader" | "sharedPage";
  eventsFor: (timer: CookingTimer) => CookingTimerEvents;
  now: number;
  running: readonly CookingTimer[];
  ringing: readonly CookingTimer[];
  awake: boolean;
  narrationHeld: boolean;
  start: (start: CookingTimerStart) => void;
  pause: (id: number) => void;
  resume: (id: number) => void;
  adjust: (id: number, minutes: number) => void;
  cancel: (id: number) => void;
  dismiss: (id: number) => void;
  dismissAll: () => void;
  stop: (ids: readonly number[], by: CookingTimerEnd) => void;
  runningFrom: (source: CookingTimerSource) => CookingTimer | undefined;
  forgetHeldNarration: () => void;
  cookingOpen: boolean;
  setCookingOpen: (open: boolean) => void;
  cookRequest: CookRequest | null;
  requestCook: (request: CookRequest) => void;
  takeCookRequest: () => void;
}

// Above the router, so timers outlive the recipe they came from; a shared page provides its own.
const CookingTimersContext = createContext<CookingTimers | null>(null);

export const CookingTimersProvider = CookingTimersContext.Provider;

export const useCookingTimers = (): CookingTimers => {
  const timers = useContext(CookingTimersContext);
  if (timers === null) {
    throw new Error("useCookingTimers must be used within a CookingTimersProvider");
  }
  return timers;
};

// Changes when a timer starts, rings or ends, not on every tick.
export interface CookingTimerList {
  all: readonly CookingTimer[];
  narrationHeld: boolean;
  stop: (ids: readonly number[], by: CookingTimerEnd) => void;
}

const CookingTimerListContext = createContext<CookingTimerList | null>(null);

export const CookingTimerListProvider = CookingTimerListContext.Provider;

export const useCookingTimerList = (): CookingTimerList => {
  const list = useContext(CookingTimerListContext);
  if (list === null) {
    throw new Error("useCookingTimerList must be used within a CookingTimerListProvider");
  }
  return list;
};
