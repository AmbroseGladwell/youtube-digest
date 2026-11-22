import { createContext, useContext, type MouseEvent } from "react";

// `element` is null for a page that lends its link without drawing one: the slot holds it from the start.
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

export const useBackLinkHandoff = (): BackLinkHandoff => {
  return useContext(BackLinkHandoffContext);
};
