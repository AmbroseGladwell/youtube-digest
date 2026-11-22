import { recipeMinutes, type Plan, type TranscriptionFailure, type TranscriptionOffer, type TranscriptionUsage } from "@overview/domain";
import { resetDate } from "../../newOverview/util/usageLine.js";

const HOUR = 3600;
const A_FEW_MINUTES = "a few minutes";

// "1 hr 56 min", as an episode's length reads (design 305, Notes: Copy).
export const audioLength = (seconds: number): string => recipeMinutes(Math.max(0, Math.round(seconds / 60)));

// About a minute of waiting for each hour of audio, measured on 16 Nov 2026, in whole minutes.
export const transcribeMinutes = (episodeSeconds: number | null): number | null =>
  episodeSeconds === null ? null : Math.max(1, Math.ceil(episodeSeconds / HOUR));

const about = (episodeSeconds: number | null): string => {
  const minutes = transcribeMinutes(episodeSeconds);
  return minutes === null ? A_FEW_MINUTES : `about ${minutes} min`;
};

const takesOf = (minutes: number | null): string => {
  if (minutes === null) {
    return A_FEW_MINUTES;
  }
  return minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
};

const leftOf = (usage: TranscriptionUsage): number => Math.max(0, usage.limitSeconds - usage.usedSeconds);

export type TranscriptionStopRoute = "plans" | "plus" | null;

export interface TranscriptionNotice {
  heading: string;
  body: string;
}

interface MoreTranscriptionOffer {
  upsell: string;
  route: TranscriptionStopRoute;
}

// What else transcribes more, for a plan that has somewhere to go (design 305h).
const moreOf = (plan: Plan): MoreTranscriptionOffer => {
  if (plan === "free") {
    return { upsell: "BYO Plus transcribes 15 hours a month, Plus 30.", route: "plans" };
  }
  if (plan === "byo-plus") {
    return { upsell: "Plus transcribes 30 hours a month.", route: "plus" };
  }
  return { upsell: "30 is the most any plan gives, so there’s no upgrade for this.", route: null };
};

// Every word a reader reads about transcribing an episode: "transcribing" is the noun throughout,
// never minutes, credits or the provider (designs 305c–305k).
export const transcriptionCopy = {
  // 305c: on the card, once the check says the episode has no words.
  needs: (episodeSeconds: number | null): string => `Needs transcribing · ${about(episodeSeconds)}`,

  // 305c and 305c-2: under the action, what choosing it uses.
  uses: (episodeSeconds: number | null, usage: TranscriptionUsage | null): string => {
    const left = usage === null ? null : `your ${audioLength(leftOf(usage))} transcribing left`;
    if (episodeSeconds === null) {
      return left === null
        ? "Its length isn’t known until we have the audio. It also uses one overview"
        : `Its length isn’t known until we have the audio, and it counts against ${left}. It also uses one overview`;
    }
    return left === null
      ? `Uses ${audioLength(episodeSeconds)} of transcribing, and one overview`
      : `Uses ${audioLength(episodeSeconds)} of ${left}, and one overview`;
  },

  // 305d: nothing is spent.
  free: (why: Extract<TranscriptionOffer, { status: "free" }>["why"]): string =>
    why === "transcribed"
      ? "You transcribed this episode before, so it uses no transcribing time."
      : "You’re already transcribing this episode, so this joins it and uses no more time.",

  // 305c-2: asked after Create, when the check couldn't tell.
  ask: (episodeSeconds: number | null): TranscriptionNotice => {
    const minutes = transcribeMinutes(episodeSeconds);
    const takes = takesOf(minutes);
    return {
      heading: "This episode needs transcribing",
      body: `We couldn’t find a transcript for this episode, so we’ll make one from its audio. It takes ${takes}.`,
    };
  },

  // 305h and 305j: the stop that takes the action's place.
  stop: (
    offer: Extract<TranscriptionOffer, { status: "not-enough" | "too-long" }>,
    plan: Plan,
    resetsOn: string | null,
  ): TranscriptionNotice & { route: TranscriptionStopRoute } => {
    if (offer.status === "too-long") {
      return {
        heading: "Episodes over 4 hours can’t be transcribed",
        body: `This one is ${audioLength(offer.episodeSeconds)}. If the show has it on YouTube, that link makes an overview of it instead. No overview was used.`,
        route: null,
      };
    }
    const hours = Math.round(offer.usage.limitSeconds / HOUR);
    const again = `You’ll have ${hours} hours again${resetsOn === null ? " next month" : ` on ${resetDate(resetsOn)}`}.`;
    const { upsell, route } = moreOf(plan);
    const left = leftOf(offer.usage);
    if (left <= 0 || offer.episodeSeconds === null) {
      return {
        heading: `You’ve used this month’s ${hours} hours of transcribing`,
        body: `${again} ${upsell} No overview was used.`,
        route,
      };
    }
    return {
      heading: "You don’t have enough transcribing left for this one",
      body: `It’s ${audioLength(offer.episodeSeconds)}, and you have ${audioLength(left)} left this month. ${again} ${upsell} No overview was used.`,
      route,
    };
  },

  // 305k: each way it can fail, none of them counted.
  failed: (reason: TranscriptionFailure | "no-audio"): TranscriptionNotice & { retry: boolean } => {
    const counted = "Nothing was counted: no transcribing time and no overview.";
    if (reason === "no-transcriber") {
      return {
        heading: "Transcribing couldn’t start",
        body: `Every transcriber was busy for two minutes, so we stopped rather than keep you waiting. Try again in a minute. ${counted}`,
        retry: true,
      };
    }
    if (reason === "audio-unreachable" || reason === "no-audio") {
      return {
        heading: "We couldn’t get the episode’s audio",
        body: `The show’s host didn’t let us download it. That’s usually on their side. ${counted}`,
        retry: false,
      };
    }
    if (reason === "no-speech") {
      return {
        heading: "We couldn’t hear any words in it",
        body: `The episode’s audio has no speech we could transcribe. ${counted}`,
        retry: false,
      };
    }
    return {
      heading: "Transcribing stopped partway",
      body: `Something went wrong while we were making the transcript, and trying again didn’t fix it. ${counted}`,
      retry: true,
    };
  },

  // 305e: beside the step, never a percentage, in whole minutes.
  progress: (state: "starting" | "transcribing", episodeSeconds: number | null, transcribingForMs: number): string => {
    if (state === "starting") {
      return "Starting…";
    }
    const minutes = transcribeMinutes(episodeSeconds);
    if (minutes === null) {
      return "This takes a few minutes";
    }
    const left = Math.ceil(minutes - transcribingForMs / 60_000);
    return left <= 1 ? "Almost done" : `About ${left} min left`;
  },
};
