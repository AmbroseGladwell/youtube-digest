import { useEffect, useRef, useState } from "react";
import { sourceKey, type TopicSuggestionResult } from "@overview/domain";
import { createTrialGenerationApi } from "../signedOutTrial/api/createTrialGenerationApi.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import type { OnboardingFound, OnboardingSource } from "./onboardingSources.js";

const TEXT_CHARACTERS = 4000;

export type AskedTopicSuggestions =
  | { status: "answered"; result: TopicSuggestionResult }
  | { status: "pending" }
  | { status: "failed" }
  | { status: "notAsked" };

// Asked of the model on the device's trial as soon as the source is found, so the answer is
// usually back before the reader reaches the topics screen. Not asked for a sample or a shared copy,
// or with no server to ask (docs/features/onboarding.md, "Suggested topics").
export function useTopicSuggestions(found: OnboardingFound | null, kind: OnboardingSource | null, ask: boolean): AskedTopicSuggestions {
  const apiUrl = useKnownApiUrl();
  const [answer, setAnswer] = useState<{ key: string; asked: AskedTopicSuggestions } | null>(null);
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
        if (!cancelled) setAnswer({ key, asked: { status: "answered", result } });
      })
      .catch(() => {
        if (!cancelled) setAnswer({ key, asked: { status: "failed" } });
      });
    return () => {
      cancelled = true;
    };
  }, [ask, apiUrl, key]);

  if (!ask || apiUrl === null) return { status: "notAsked" };
  return answer !== null && answer.key === key ? answer.asked : { status: "pending" };
}
