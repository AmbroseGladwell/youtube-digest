import { useEffect, useRef, useState } from "react";
import { sourceKey, type TopicSuggestionResult } from "@overview/domain";
import { createTrialGenerationApi } from "../signedOutTrial/api/createTrialGenerationApi.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import type { OnboardingFound, OnboardingSource } from "./onboardingSources.js";

const TEXT_CHARACTERS = 4000;

// Asked of the model on the device's trial as soon as the source is found, so the answer is
// usually back before the reader reaches the topics screen; null until it is, and for good if it
// fails or there's no server to ask (docs/features/onboarding.md, "Suggested topics").
export function useTopicSuggestions(found: OnboardingFound | null, kind: OnboardingSource | null, ask: boolean): TopicSuggestionResult | null {
  const apiUrl = useKnownApiUrl();
  const [answer, setAnswer] = useState<{ key: string; result: TopicSuggestionResult } | null>(null);
  const key = found === null ? null : sourceKey(found.source);
  const latest = useRef({ found, kind });
  latest.current = { found, kind };

  useEffect(() => {
    const { found, kind } = latest.current;
    if (!ask || apiUrl === null || found === null || kind === null || key === null) return;
    let cancelled = false;
    const noun = kind.noun("video", found);
    createTrialGenerationApi({ baseUrl: apiUrl })
      .topicSuggestions({
        title: found.source.title,
        kind: noun === "recipe" ? "recipe" : noun === "video" ? "video" : "article",
        text: found.about.slice(0, TEXT_CHARACTERS),
      })
      .then((result) => {
        if (!cancelled) setAnswer({ key, result });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ask, apiUrl, key]);

  return answer !== null && answer.key === key ? answer.result : null;
}
