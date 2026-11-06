import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { usePreviousPathname } from "./HistoryTrailContext.js";

const plainClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Back in history when the destination is the entry behind this one, so its scroll
// position and view come back with it; otherwise the link goes there on its own
// (docs/features/back-within-reach.md, "Back in history, or home").
export function useBackTo(to: string): (event: MouseEvent<HTMLAnchorElement>) => void {
  const navigate = useNavigate();
  const previous = usePreviousPathname();

  return (event) => {
    if (previous !== to || !plainClick(event)) return;
    event.preventDefault();
    void navigate(-1);
  };
}
