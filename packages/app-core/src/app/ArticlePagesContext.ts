import { createContext, useContext, useSyncExternalStore } from "react";
import type { ArticlePlace, ArticleRead } from "@overview/domain";

export interface ActivePage {
  url: string;
  title: string;
  tabId: number;
}

// Everything that needs a browser tab, injected because app-core can't read chrome.*. The web
// app supplies nothing, which is what hides all of it there (docs/features/article-panel.md).
export interface ArticlePages {
  subscribe: (onChange: () => void) => () => void;
  // The ordinary web page in front of the panel. Null on YouTube, on a browser page, or with
  // no tab: those are not offers to read anything.
  getPage: () => ActivePage | null;
  hasAccess: (url: string) => Promise<boolean>;
  // Must be called inside the click, or Chrome refuses it.
  requestAccess: (url: string) => Promise<boolean>;
  read: (tabId: number) => Promise<ArticleRead>;
  reload: (tabId: number) => Promise<void>;
  // True it moved, false the place has gone, null we couldn't look.
  showPlace: (tabId: number, place: ArticlePlace) => Promise<boolean | null>;
  // The page a reader right-clicked, cleared as it is read.
  takeMenuRequest: () => ActivePage | null;
}

const ArticlePagesContext = createContext<ArticlePages | null>(null);

export const ArticlePagesProvider = ArticlePagesContext.Provider;

export function useArticlePages(): ArticlePages | null {
  return useContext(ArticlePagesContext);
}

const subscribeToNothing = () => () => {};
const noPage = () => null;

export function useActivePage(): ActivePage | null {
  const pages = useArticlePages();
  return useSyncExternalStore(pages?.subscribe ?? subscribeToNothing, pages?.getPage ?? noPage);
}
