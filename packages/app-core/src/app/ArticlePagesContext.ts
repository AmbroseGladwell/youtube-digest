import { createContext, useContext, useSyncExternalStore } from "react";
import type { ArticlePlace, ArticleRead } from "@overview/domain";

export interface ActivePage {
  url: string;
  title: string;
  tabId: number;
}

// Injected because app-core can't read chrome.*; the web app supplies none, which hides all of it there.
export interface ArticlePages {
  subscribe: (onChange: () => void) => () => void;
  // Null on YouTube, on a browser page, or with no tab: those are not offers to read anything.
  getPage: () => ActivePage | null;
  hasAccess: (url: string) => Promise<boolean>;
  // Must be called inside the click, or Chrome refuses it.
  requestAccess: (url: string) => Promise<boolean>;
  read: (tabId: number) => Promise<ArticleRead>;
  // A kept link, read in a tab of its own that closes after.
  readAt: (url: string) => Promise<ArticleRead>;
  reload: (tabId: number) => Promise<void>;
  // True it moved, false the place has gone, null we couldn't look.
  showPlace: (tabId: number, place: ArticlePlace) => Promise<boolean | null>;
  // The page a reader right-clicked, cleared as it is read.
  takeMenuRequest: () => ActivePage | null;
}

const ArticlePagesContext = createContext<ArticlePages | null>(null);

export const ArticlePagesProvider = ArticlePagesContext.Provider;

export const useArticlePages = (): ArticlePages | null => {
  return useContext(ArticlePagesContext);
};

const subscribeToNothing = () => () => {};
const noPage = () => null;

export const useActivePage = (): ActivePage | null => {
  const pages = useArticlePages();
  return useSyncExternalStore(pages?.subscribe ?? subscribeToNothing, pages?.getPage ?? noPage);
};
