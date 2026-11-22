import { useEffect, useRef, useState } from "react";
import { sourceKey, type TopicSuggestionResult } from "@overview/domain";
import { createTrialGenerationApi } from "../signedOutTrial/api/createTrialGenerationApi.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import type { OnboardingFound, OnboardingSource } from "./onboardingSources.js";

const TEXT_CHARACTERS = 4000;

const suggestionKindOf = (noun: string): "video" | "article" | "recipe" => {
  if (noun === "recipe") {
    return "recipe";
  }
  return noun === "video" ? "video" : "article";
};

export type AskedTopicSuggestions =
  | { status: "answered"; result: TopicSuggestionResult }
  | { status: "pending" }
  | { status: "failed" }
  | { status: "notAsked" };

// Asked as soon as the source is found: docs/features/onboarding.md, "Suggested topics".
export const useTopicSuggestions = (found: OnboardingFound | null, kind: OnboardingSource | null, ask: boolean): AskedTopicSuggestions => {
  const apiUrl = useKnownApiUrl();
  const [answer, setAnswer] = useState<{ key: string; asked: AskedTopicSuggestions } | null>(null);
  const key = found === null ? null : sourceKey(found.source);
  const latest = useRef({ found, kind });
  latest.current = { found, kind };

  useEffect(() => {
    const { found, kind } = latest.current;
    if (!ask || apiUrl === null || found === null || kind === null || key === null) {
      return;
    }
    let cancelled = false;
    const noun = kind.noun("video", found);
    createTrialGenerationApi({ baseUrl: apiUrl })
      .topicSuggestions({
        title: found.source.title,
        kind: suggestionKindOf(noun),
        text: found.about.slice(0, TEXT_CHARACTERS),
      })
      .then((result) => {
        if (!cancelled) {
          setAnswer({ key, asked: { status: "answered", result } });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnswer({ key, asked: { status: "failed" } });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ask, apiUrl, key]);

  if (!ask || apiUrl === null) {
    return { status: "notAsked" };
  }
  return answer !== null && answer.key === key ? answer.asked : { status: "pending" };
};
