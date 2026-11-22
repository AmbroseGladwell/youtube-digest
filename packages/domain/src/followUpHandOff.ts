import { FOLLOW_UP_ASSISTANTS, type FollowUpAssistant } from "./FollowUpAssistant.js";

// Under the ~51,000 characters owner-tested on 14 Nov 2026; longer links may arrive cut short.
export const MOST_PREFILL_URL_LENGTH = 50_000;

export type FollowUpHandOff = { kind: "prefill"; url: string } | { kind: "copyThenOpen"; url: string; text: string };

export const followUpHandOff = (assistant: FollowUpAssistant, prompt: string): FollowUpHandOff => {
  const { openUrl, prefillParam } = FOLLOW_UP_ASSISTANTS[assistant];
  if (prefillParam !== null) {
    const url = new URL(openUrl);
    url.searchParams.set(prefillParam, prompt);
    if (url.href.length <= MOST_PREFILL_URL_LENGTH) {
      return { kind: "prefill", url: url.href };
    }
  }
  return { kind: "copyThenOpen", url: openUrl, text: prompt };
};
