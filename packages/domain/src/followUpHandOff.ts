import { FOLLOW_UP_ASSISTANTS, type FollowUpAssistant } from "./FollowUpAssistant.js";

// Just under the longest link the owner has seen Claude and ChatGPT fill in from whole, about
// 51,000 characters (14 November 2026). Past it a link may arrive cut short, so the prompt is
// copied instead.
export const MOST_PREFILL_URL_LENGTH = 50_000;

export type FollowUpHandOff = { kind: "prefill"; url: string } | { kind: "copyThenOpen"; url: string; text: string };

// How a question reaches the assistant: in the link that opens it when it can be filled in that
// way and the link isn't too long, otherwise copied for the reader to paste into it.
export function followUpHandOff(assistant: FollowUpAssistant, prompt: string): FollowUpHandOff {
  const { openUrl, prefillParam } = FOLLOW_UP_ASSISTANTS[assistant];
  if (prefillParam !== null) {
    const url = new URL(openUrl);
    url.searchParams.set(prefillParam, prompt);
    if (url.href.length <= MOST_PREFILL_URL_LENGTH) {
      return { kind: "prefill", url: url.href };
    }
  }
  return { kind: "copyThenOpen", url: openUrl, text: prompt };
}
