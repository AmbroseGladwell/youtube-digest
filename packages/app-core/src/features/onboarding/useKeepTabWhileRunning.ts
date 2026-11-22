import { useEffect } from "react";
import type { WaitPhase } from "./util/waitTimeline.js";

export const readyTabTitle = (title: string): string => `Ready: ${title}`;

// The wait's two ways of keeping the reader (README "F · Wait", Build): a prompt before a running
// tab closes, and a tab title that says it's done.
export function useKeepTabWhileRunning(phase: WaitPhase, title: string): void {
  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    const holdOpen = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", holdOpen);
    return () => window.removeEventListener("beforeunload", holdOpen);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready") {
      return;
    }
    const previous = document.title;
    document.title = readyTabTitle(title);
    return () => {
      document.title = previous;
    };
  }, [phase, title]);
}
