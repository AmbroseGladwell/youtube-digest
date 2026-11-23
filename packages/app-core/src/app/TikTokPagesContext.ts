import { createContext, useContext } from "react";
import type { TikTokRead } from "@overview/domain";

// The reader's own browser reading a TikTok, free and before the vendor (docs/features/tiktok-links.md, "The extension's own read").
export type OwnTikTokRead = TikTokRead | { status: "failed"; reason: "no-access" };

// Injected because app-core can't reach chrome.*; the web app supplies none, so every TikTok goes to our server there.
export interface TikTokPages {
  hasAccess: () => Promise<boolean>;
  // Must be called inside the click, or Chrome refuses it.
  requestAccess: () => Promise<boolean>;
  read: (link: string) => Promise<OwnTikTokRead>;
}

const TikTokPagesContext = createContext<TikTokPages | null>(null);

export const TikTokPagesProvider = TikTokPagesContext.Provider;

export const useTikTokPages = (): TikTokPages | null => useContext(TikTokPagesContext);
