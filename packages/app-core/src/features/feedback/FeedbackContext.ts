import { createContext, useContext } from "react";
import type { OverviewId, Source } from "@overview/domain";

export interface FeedbackAbout {
  overviewId: OverviewId;
  title: string;
  source: Source;
}

export type FeedbackFrom = "accountMenu" | "overviewMenu";

export interface FeedbackOpening {
  about: FeedbackAbout | null;
  from: FeedbackFrom;
  returnFocusTo: HTMLElement | null;
}

export interface FeedbackBox {
  open(opening: FeedbackOpening): void;
}

const FeedbackContext = createContext<FeedbackBox | null>(null);

export const FeedbackProvider = FeedbackContext.Provider;

// Null when signed out, so the ways in hide rather than offering a box that can't send.
export const useFeedbackBox = (): FeedbackBox | null => useContext(FeedbackContext);
