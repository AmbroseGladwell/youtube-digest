import { chatAllowances, overviewQuotas, saveQuotas, transcriptionHours, type Plan } from "@overview/domain";
import { audioLength } from "../../podcasts/util/transcriptionCopy.js";
import { resetDate } from "../../newOverview/util/usageLine.js";
import { PAID_PRICES } from "../planCards.js";

export interface LimitCopy {
  heading: string;
  body: string;
  plusLine: string | null;
  waitTitle: string;
  waitBody: string;
}

const FROM = `From ${PAID_PRICES.plus.yearlyPerMonth} a month, cancel anytime.`;
const count = (value: number) => value.toLocaleString("en-GB");

const plusOnly = (plan: Plan, line: string): string | null => (plan === "plus" ? null : `${line} ${FROM}`);

export interface HoursLimit {
  plan: Plan;
  resetsOn: string;
  usedSeconds: number;
  limitSeconds: number;
  episodeSeconds: number | null;
  // What is transcribed: an episode, a TikTok, a video.
  noun?: string;
}

// Designs 351g–351i: what ran out and when it's back, Plus, and the wait.
export const limitCopy = {
  hours: ({ plan, resetsOn, usedSeconds, limitSeconds, episodeSeconds, noun = "episode" }: HoursLimit): LimitCopy => {
    const back = resetDate(resetsOn);
    const left = Math.max(0, limitSeconds - usedSeconds);
    const needs = episodeSeconds === null ? "" : `This ${noun} needs about ${audioLength(episodeSeconds)} of it. `;
    return {
      heading:
        left > 0 && episodeSeconds !== null
          ? `You have ${audioLength(left)} of transcribing left, and this ${noun} needs about ${audioLength(episodeSeconds)}.`
          : `You’ve used this month’s ${transcriptionHours[plan]} hours of transcribing.`,
      body: left > 0 && episodeSeconds !== null ? `Your hours come back on ${back}.` : `${needs}Your hours come back on ${back}.`,
      plusLine: plusOnly(
        plan,
        `${transcriptionHours.plus} hours of transcribing a month, and ${overviewQuotas.plus.ours} overviews on us.`,
      ),
      waitTitle: `Wait for ${back}`,
      waitBody: "We’ll keep this link and transcribe it when your hours are back.",
    };
  },

  chat: (plan: Plan, resetsOn: string): LimitCopy => {
    const back = resetDate(resetsOn);
    return {
      heading: "You’ve used this month’s questions on us.",
      body: `Asking comes back on ${back}. Everything you’ve saved still reads and plays.`,
      plusLine: plusOnly(plan, `About ${count(chatAllowances.plus)} questions a month, against ${count(chatAllowances[plan])}.`),
      waitTitle: `Wait for ${back}`,
      waitBody: "Your questions are back then, with this chat as you left it.",
    };
  },

  saves: (plan: Plan, resetsOn: string): LimitCopy => {
    const back = resetDate(resetsOn);
    return {
      heading: `You’ve saved ${saveQuotas[plan]} this month without an overview.`,
      body: `Saving comes back on ${back}. What you’ve saved is all still there.`,
      plusLine: plusOnly(plan, `${overviewQuotas.plus.ours} overviews and ${saveQuotas.plus} saves a month.`),
      waitTitle: `Wait for ${back}`,
      waitBody: `Save this link then, or paste it again when your ${overviewQuotas[plan].ours} overviews are back.`,
    };
  },
};
