import { useEffect, useRef } from "react";
import type { ChatMeterState } from "./util/chatMeterOf.js";

// OV-376 analytics: each meter state reported once while the chat is open.
export const useChatMeterShown = (state: ChatMeterState | null, report: (state: ChatMeterState) => void): void => {
  const seen = useRef(new Set<ChatMeterState>());
  const reportRef = useRef(report);
  reportRef.current = report;
  useEffect(() => {
    if (state === null || seen.current.has(state)) {
      return;
    }
    seen.current.add(state);
    reportRef.current(state);
  }, [state]);
};
