import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { useBackLinkHandoff } from "./BackLinkHandoffContext.js";

export interface LentBackLink {
  to: string;
  label: string;
  follow: (event: MouseEvent<HTMLAnchorElement>) => void;
  lent?: boolean;
  // False where the page draws no link of its own and the bar holds it throughout, which
  // is settings and its sections in the panel (design 205d-2). The returned ref goes
  // nowhere then, and the shell is told there is no element to watch.
  inPage?: boolean;
}

// The ref goes on the page's own back link. Registered from an effect rather than a
// callback ref: the router's Link merges refs into a new function every render, which
// would detach and re-attach a callback ref, and set the shell's state, on each one.
export function useLentBackLink({ to, label, follow, lent = true, inPage = true }: LentBackLink): RefObject<HTMLAnchorElement | null> {
  const handoff = useBackLinkHandoff();
  const latestFollow = useRef(follow);
  latestFollow.current = follow;
  const element = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const link = inPage ? element.current : null;
    if (!lent || (inPage && link === null)) return;
    handoff.register({ element: link, to, label, follow: (event) => latestFollow.current(event) });
    return () => handoff.register(null);
  }, [handoff, to, label, lent, inPage]);

  return element;
}
