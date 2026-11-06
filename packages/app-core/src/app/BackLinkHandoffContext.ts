import { createContext, useContext, type MouseEvent } from "react";

// A page's own back link, lent to the shell so the bar's brand slot can take over once
// the link has scrolled under the bar (docs/features/back-within-reach.md).
export interface HeadBackLink {
  element: HTMLElement;
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
