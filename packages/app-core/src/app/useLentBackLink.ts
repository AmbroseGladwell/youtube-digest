import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { useBackLinkHandoff } from "./BackLinkHandoffContext.js";

export interface LentBackLink {
  to: string;
  label: string;
  follow: (event: MouseEvent<HTMLAnchorElement>) => void;
  lent?: boolean;
  // False where the page draws no link of its own and the bar holds it throughout.
  inPage?: boolean;
}

// An effect, not a callback ref: the router's Link merges refs anew each render, re-attaching a callback ref.
export const useLentBackLink = ({ to, label, follow, lent = true, inPage = true }: LentBackLink): RefObject<HTMLAnchorElement | null> => {
  const handoff = useBackLinkHandoff();
  const latestFollow = useRef(follow);
  latestFollow.current = follow;
  const element = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const link = inPage ? element.current : null;
    if (!lent || (inPage && link === null)) {
      return;
    }
    handoff.register({ element: link, to, label, follow: (event) => latestFollow.current(event) });
    return () => handoff.register(null);
  }, [handoff, to, label, lent, inPage]);

  return element;
};
