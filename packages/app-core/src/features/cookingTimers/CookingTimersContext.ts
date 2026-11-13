import { createContext, useContext } from "react";
import type { OverviewPageEvents } from "@overview/domain";
import type { EventMethod } from "../analytics/createAnalytics.js";
import type { CookingTimer, CookingTimerSource, CookingTimerStart } from "../reader/util/cookingTimers.js";

export type CookingTimerEvents = {
  [A in keyof OverviewPageEvents["cooking"]]: EventMethod<OverviewPageEvents["cooking"][A]>;
};

export type CookingTimerEnd = "dismissed" | "cancelled" | "left" | "signedOut" | "leftPage";

// A way back into a recipe's cooking mode at the action a timer came from (design 288s).
export interface CookRequest {
  recipe: string;
  action: number;
  actionText: string;
}

export interface CookingTimers {
  // The app's timers, each on a recipe in the library, or a shared page's, on its one copy.
  scope: "reader" | "sharedPage";
  // A timer's events, counted on the recipe it came from.
  eventsFor: (timer: CookingTimer) => CookingTimerEvents;
  now: number;
  running: readonly CookingTimer[];
  ringing: readonly CookingTimer[];
  // True while the screen is held on for the timers (OV-288 edge case 1).
  awake: boolean;
  // True while a ring is holding the narration paused, for the player to say so (design 288w).
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
  // While a recipe's cooking mode is open it shows the timers itself, so the dock steps aside.
  cookingOpen: boolean;
  setCookingOpen: (open: boolean) => void;
  cookRequest: CookRequest | null;
  requestCook: (request: CookRequest) => void;
  takeCookRequest: () => void;
}

// The tab's cooking timers, above the router so they outlive the recipe they came from
// (OV-288). The shared page provides its own, scoped to that page.
const CookingTimersContext = createContext<CookingTimers | null>(null);

export const CookingTimersProvider = CookingTimersContext.Provider;

export function useCookingTimers(): CookingTimers {
  const timers = useContext(CookingTimersContext);
  if (timers === null) throw new Error("useCookingTimers must be used within a CookingTimersProvider");
  return timers;
}

// The timers themselves, without the clock: for what only needs to know which timers there are,
// such as a warning that something will stop them, or the player saying it is paused for one.
// It changes when a timer starts, rings or ends, not on every tick.
export interface CookingTimerList {
  all: readonly CookingTimer[];
  narrationHeld: boolean;
  stop: (ids: readonly number[], by: CookingTimerEnd) => void;
}

const CookingTimerListContext = createContext<CookingTimerList | null>(null);

export const CookingTimerListProvider = CookingTimerListContext.Provider;

export function useCookingTimerList(): CookingTimerList {
  const list = useContext(CookingTimerListContext);
  if (list === null) throw new Error("useCookingTimerList must be used within a CookingTimerListProvider");
  return list;
}
