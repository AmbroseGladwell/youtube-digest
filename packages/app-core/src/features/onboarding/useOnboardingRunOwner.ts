import { useEffect, useRef, useState } from "react";
import type { OnboardingRunPhase } from "./useOnboardingRun.js";

export const ONBOARDING_RUN_CHANNEL = "overview.onboarding.run";
const ANSWER_WITHIN_MS = 1500;
const ASK_EVERY_MS = 3000;

export type OnboardingRunMessage = { type: "ask"; link: string } | { type: "held"; link: string; phase: OnboardingRunPhase };

export interface HeldElsewhere {
  phase: OnboardingRunPhase;
}

const openChannel = (): BroadcastChannel | null =>
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(ONBOARDING_RUN_CHANNEL);

const messageOf = (event: MessageEvent): OnboardingRunMessage | null => {
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null || !("type" in data) || !("link" in data)) return null;
  return data as OnboardingRunMessage;
};

// The run lives in one tab. Another tab with the same onboarding, the sign-in link's for
// instance, asks over a channel whether that tab still has it, and mirrors what it answers.
// When nothing answers, the tab is gone, and the asking tab takes the run over
// (docs/features/onboarding.md, "The run lives in one tab").
export function useOnboardingRunOwner({
  link,
  wanted,
  mine,
  phase,
  claim,
}: {
  link: string | null;
  // There is a run to have: nothing made yet, and a kind of link to make it from.
  wanted: boolean;
  mine: boolean;
  phase: OnboardingRunPhase;
  claim: () => void;
}): HeldElsewhere | null {
  const [held, setHeld] = useState<HeldElsewhere | null>(null);
  const latest = useRef({ phase, claim });
  latest.current = { phase, claim };

  useEffect(() => {
    if (!mine || !wanted || link === null) return;
    const channel = openChannel();
    if (channel === null) return;
    channel.onmessage = (event) => {
      const message = messageOf(event);
      if (message?.type === "ask" && message.link === link) {
        channel.postMessage({ type: "held", link, phase: latest.current.phase } satisfies OnboardingRunMessage);
      }
    };
    return () => channel.close();
  }, [mine, wanted, link]);

  useEffect(() => {
    setHeld(null);
    if (mine || !wanted || link === null) return;
    const channel = openChannel();
    if (channel === null) {
      latest.current.claim();
      return;
    }
    let answered = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    channel.onmessage = (event) => {
      const message = messageOf(event);
      if (message?.type === "held" && message.link === link) {
        answered = true;
        setHeld({ phase: message.phase });
      }
    };
    const ask = () => {
      answered = false;
      channel.postMessage({ type: "ask", link } satisfies OnboardingRunMessage);
      timer = setTimeout(() => {
        if (answered) timer = setTimeout(ask, ASK_EVERY_MS - ANSWER_WITHIN_MS);
        else latest.current.claim();
      }, ANSWER_WITHIN_MS);
    };
    ask();
    return () => {
      if (timer !== null) clearTimeout(timer);
      channel.close();
    };
  }, [mine, wanted, link]);

  return mine ? null : held;
}
