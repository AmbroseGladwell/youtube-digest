import { useState } from "react";
import { EMPTY_ABOUT_YOU, type AboutYou, type AboutYouSection } from "@overview/domain";
import { useTopicsQuery } from "../overviews/queries/topicsQuery.js";
import type { AboutYouAsking } from "./useAboutYouAsk.js";

// The sentence as it is being filled in, from empty each time it is asked.
export const useAboutYouAnswer = (asking: AboutYouAsking | null) => {
  const [answer, setAnswer] = useState<AboutYou>(EMPTY_ABOUT_YOU);
  const [shown, setShown] = useState(asking);
  if (shown !== asking) {
    setShown(asking);
    if (asking !== null) {
      setAnswer(EMPTY_ABOUT_YOU);
    }
  }
  const topicNames = (useTopicsQuery().data ?? []).map(({ name }) => name);
  const change = (section: AboutYouSection, entries: string[]) => setAnswer((current) => ({ ...current, [section]: entries }));
  return { answer, change, topicNames };
};
