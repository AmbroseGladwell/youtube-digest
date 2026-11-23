import { recipeMinutes, type TranscriptCheck } from "@overview/domain";
import { audioLength } from "../../podcasts/util/transcriptionCopy.js";

// Free's hours, as the check answers signed out: the episode is transcribed once there's an account.
const FREE_HOURS = 5;

export interface EpisodeWordsNotice {
  notice: string | null;
  stop: string | null;
}

const NOTHING: EpisodeWordsNotice = { notice: null, stop: null };

// A TikTok with no captions, said as an episode's is, in its own words and seconds.
export const tiktokWordsNotice = (check: TranscriptCheck | null | undefined): EpisodeWordsNotice => {
  if (check?.words !== "none" || (check.transcription.status !== "needed" && check.transcription.status !== "not-enough")) {
    return NOTHING;
  }
  const { episodeSeconds, usage } = check.transcription;
  const hours = Math.round(usage.limitSeconds / 3600);
  const allowance = `your ${hours}${hours === FREE_HOURS ? " free" : ""} hours this month`;
  const use = episodeSeconds === null ? `, from ${allowance}` : `: ${audioLength(episodeSeconds)} of ${allowance}`;
  return { notice: `There are no captions, so we’ll make a transcript from its sound${use}.`, stop: null };
};

// Said before anything is used, so Looks right carries the consent to transcribe (327v–327w-4).
export const episodeWordsNotice = (check: TranscriptCheck | null | undefined, durationMs: number | null): EpisodeWordsNotice => {
  if (check == null || check.words === "found") {
    return NOTHING;
  }
  if (check.words === "unknown") {
    return { notice: `If there’s no transcript we’ll make one from the audio. Free includes ${FREE_HOURS} hours a month.`, stop: null };
  }
  const offer = check.transcription;
  switch (offer.status) {
    case "free":
      return NOTHING;
    case "too-long":
      return {
        notice: null,
        stop: "This episode is over 4 hours, so it can’t be transcribed. Try an episode under 4 hours, or one with a transcript.",
      };
    case "no-audio":
      return {
        notice: null,
        stop: "This episode’s audio isn’t in the public feed, so there’s nothing to transcribe. Try a different episode, or the same one on YouTube.",
      };
    case "unavailable":
      return NOTHING;
    case "needed":
    case "not-enough": {
      const seconds = offer.episodeSeconds ?? (durationMs === null ? null : durationMs / 1000);
      const hours = Math.round(offer.usage.limitSeconds / 3600);
      const allowance = `your ${hours}${hours === FREE_HOURS ? " free" : ""} hours this month`;
      const use =
        seconds === null ? `, from ${allowance}` : `: about ${recipeMinutes(Math.max(1, Math.round(seconds / 60)))} of ${allowance}`;
      return { notice: `There’s no transcript, so we’ll make one from the audio${use}.`, stop: null };
    }
  }
};
