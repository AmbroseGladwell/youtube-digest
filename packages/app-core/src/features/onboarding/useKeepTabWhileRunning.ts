import { useEffect } from "react";
import type { WaitPhase } from "./util/waitTimeline.js";

export const readyTabTitle = (title: string): string => `Ready: ${title}`;

export const useKeepTabWhileRunning = (phase: WaitPhase, title: string): void => {
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
};
