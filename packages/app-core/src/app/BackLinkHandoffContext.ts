import { createContext, useContext, type MouseEvent } from "react";

// A page's own back link, lent to the shell so the bar's brand slot can take over once
// the link has scrolled under the bar (docs/features/back-within-reach.md). A page with no
// head to scroll away lends the link without drawing one, and the slot holds it from the
// first frame: `element` is null there (design 205d-2).
export interface HeadBackLink {
  element: HTMLElement | null;
  to: string;
  label: string;
  follow: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface BackLinkHandoff {
  register: (link: HeadBackLink | null) => void;
}

const BackLinkHandoffContext = createContext<BackLinkHandoff>({ register: () => {} });

export const BackLinkHandoffProvider = BackLinkHandoffContext.Provider;

export function useBackLinkHandoff(): BackLinkHandoff {
  return useContext(BackLinkHandoffContext);
}
