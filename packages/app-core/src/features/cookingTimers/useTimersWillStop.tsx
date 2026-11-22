import { useState, type ReactNode } from "react";
import { timerSpokenName } from "../reader/util/timerText.js";
import { useCookingTimerList, type CookingTimerEnd } from "./CookingTimersContext.js";
import { TimersWillStopDialog, type TimersWillStopCopy } from "./components/TimersWillStopDialog/TimersWillStopDialog.js";

export const signOutCopy = (count: number): TimersWillStopCopy => ({
  sentence: "Signing out stops your timers, since they belong to this account’s recipes.",
  stay: "Stay signed in",
  go: count === 1 ? "Sign out and stop it" : "Sign out and stop them",
});

interface Asking {
  copy: TimersWillStopCopy;
  by: CookingTimerEnd;
  go: () => void;
  stay: () => void;
}

export interface TimersWillStop {
  count: number;
  ask: (copy: TimersWillStopCopy, by: CookingTimerEnd, go: () => void, stay?: () => void) => void;
  dialog: ReactNode;
}

export const useTimersWillStop = (): TimersWillStop => {
  const timers = useCookingTimerList();
  const [asking, setAsking] = useState<Asking | null>(null);
  const { all } = timers;
  const only = all.length === 1 ? all[0]! : null;
  const heading = only === null ? "Your timers will stop" : `Your ${timerSpokenName(only).toLowerCase()} will stop`;

  return {
    count: all.length,
    ask: (copy, by, go, stay = () => undefined) => {
      if (all.length === 0) {
        go();
      } else {
        setAsking({ copy, by, go, stay });
      }
    },
    dialog: (
      <TimersWillStopDialog
        open={asking !== null}
        heading={heading}
        copy={asking?.copy ?? null}
        onStay={() => {
          asking?.stay();
          setAsking(null);
        }}
        onGo={() => {
          if (asking === null) {
            return;
          }
          timers.stop(
            all.map((timer) => timer.id),
            asking.by,
          );
          setAsking(null);
          asking.go();
        }}
      />
    ),
  };
};
