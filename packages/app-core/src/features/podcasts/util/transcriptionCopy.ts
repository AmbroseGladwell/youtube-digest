import {
  recipeMinutes,
  type Plan,
  type TranscribedSource,
  type TranscriptionFailure,
  type TranscriptionOffer,
  type TranscriptionUsage,
} from "@overview/domain";
import { resetDate } from "../../newOverview/util/usageLine.js";

const HOUR = 3600;
const A_FEW_MINUTES = "a few minutes";

// A TikTok's seconds as the note says them (130g), an episode's in minutes.
export const audioLength = (seconds: number): string =>
  seconds < 60 ? `${Math.max(1, Math.round(seconds))} s` : recipeMinutes(Math.round(seconds / 60));

const NOUN: Record<TranscribedSource, string> = { podcast: "episode", tiktok: "TikTok", instagram: "video", facebook: "video" };

// About a minute of waiting for each hour of audio, measured on 16 Nov 2026.
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

const moreOf = (plan: Plan): MoreTranscriptionOffer => {
  if (plan === "free") {
    return { upsell: "BYO Plus transcribes 15 hours a month, Plus 30.", route: "plans" };
  }
  if (plan === "byo-plus") {
    return { upsell: "Plus transcribes 30 hours a month.", route: "plus" };
  }
  return { upsell: "30 is the most any plan gives, so there’s no upgrade for this.", route: null };
};

// "Transcribing" is the noun throughout, never minutes, credits or the provider.
export const transcriptionCopy = {
  needs: (episodeSeconds: number | null): string => `Needs transcribing · ${about(episodeSeconds)}`,

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

  free: (why: Extract<TranscriptionOffer, { status: "free" }>["why"], source: TranscribedSource = "podcast"): string =>
    why === "transcribed"
      ? `You transcribed this ${NOUN[source]} before, so it uses no transcribing time.`
      : `You’re already transcribing this ${NOUN[source]}, so this joins it and uses no more time.`,

  // Asked after Create, when the check couldn't tell.
  ask: (episodeSeconds: number | null): TranscriptionNotice => {
    const minutes = transcribeMinutes(episodeSeconds);
    const takes = takesOf(minutes);
    return {
      heading: "This episode needs transcribing",
      body: `We couldn’t find a transcript for this episode, so we’ll make one from its audio. It takes ${takes}.`,
    };
  },

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

  failed: (reason: TranscriptionFailure | "no-audio", source: TranscribedSource = "podcast"): TranscriptionNotice & { retry: boolean } => {
    const counted = "Nothing was counted: no transcribing time and no overview.";
    if (reason === "no-transcriber") {
      return {
        heading: "Transcribing couldn’t start",
        body: `Every transcriber was busy for two minutes, so we stopped rather than keep you waiting. Try again in a minute. ${counted}`,
        retry: true,
      };
    }
    if (source === "tiktok" && (reason === "audio-unreachable" || reason === "no-audio")) {
      return {
        heading: "We couldn’t get the TikTok’s sound",
        body: `TikTok didn’t let us download the video just now. Try again in a while. ${counted}`,
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
        body: `The ${NOUN[source]}’s ${source === "podcast" ? "audio" : "sound"} has no speech we could transcribe. ${counted}`,
        retry: false,
      };
    }
    return {
      heading: "Transcribing stopped partway",
      body: `Something went wrong while we were making the transcript, and trying again didn’t fix it. ${counted}`,
      retry: true,
    };
  },

  // Never a percentage.
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
