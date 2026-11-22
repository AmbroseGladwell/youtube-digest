import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { usePreviousPathname } from "./HistoryTrailContext.js";

const plainClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Why back in history when it can: docs/features/back-within-reach.md, "Back in history, or home".
export const useBackTo = (to: string): ((event: MouseEvent<HTMLAnchorElement>) => void) => {
  const navigate = useNavigate();
  const previous = usePreviousPathname();

  return (event) => {
    if (previous !== to || !plainClick(event)) {
      return;
    }
    event.preventDefault();
    void navigate(-1);
  };
};
