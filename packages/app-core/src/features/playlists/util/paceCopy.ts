import { paceDailyLimit, type PlaylistPace } from "@overview/domain";
import { formatCount } from "./tokenEstimate.js";

export const PACE_LABEL: Record<PlaylistPace, string> = {
  asTheyCome: "As they come",
  fiveADay: "Up to 5 a day",
  oneADay: "Up to 1 a day",
  whenChosen: "Only when I choose",
};

const PACE_IN_A_SENTENCE: Record<PlaylistPace, string> = {
  asTheyCome: "as they come",
  fiveADay: "up to 5 a day",
  oneADay: "up to 1 a day",
  whenChosen: "only when you choose",
};

const MONTH_DAYS = 30;
const DAYS_BEFORE_MONTHS = 60;

// How long a backfill takes at a pace, rounded up to whole days and read in months past 60.
export function paceSpan(days: number): string {
  if (days <= 1) return "a day";
  if (days <= DAYS_BEFORE_MONTHS) return `${formatCount(days)} days`;
  return `${formatCount(Math.round(days / MONTH_DAYS))} months`;
}

// What following at a pace would do with this playlist, worked out in code
// (docs/features/playlists.md, "The preview").
export function paceConsequence(pace: PlaylistPace, toMake: number, backfill: boolean): string {
  const limit = paceDailyLimit(pace);
  if (limit === 0) {
    return backfill && toMake > 0
      ? `All ${formatCount(toMake)} wait in the queue until you choose them, and use none of your allowance until then.`
      : "New videos wait in the queue until you choose them, and use none of your allowance until then.";
  }
  if (!backfill || toMake === 0) {
    return limit === null ? "New videos from it are made as they arrive." : `New videos from it are made up to ${limit} a day.`;
  }
  if (limit === null) return `All ${formatCount(toMake)} are made one after another, until this month’s allowance runs out.`;
  if (toMake <= limit) return `All ${formatCount(toMake)} today, then up to ${limit} a day as new ones arrive.`;
  return `${formatCount(toMake)} videos at ${limit} a day: about ${paceSpan(Math.ceil(toMake / limit))}.`;
}

// What choosing a pace in Settings would do to the videos already waiting on it (95y).
export function paceWaitEffect(pace: PlaylistPace, waiting: number): string {
  if (waiting === 0) return paceConsequence(pace, 0, false);
  const limit = paceDailyLimit(pace);
  if (limit === 0) return `The ${formatCount(waiting)} waiting stay until you choose them`;
  if (limit === null) return `The ${formatCount(waiting)} waiting carry on now`;
  if (waiting <= limit) return `The ${formatCount(waiting)} waiting are made today`;
  return `${formatCount(waiting)} waiting at ${limit} a day: about ${paceSpan(Math.ceil(waiting / limit))}`;
}

// What a change did, said once in the row it was made in.
export function paceChangedLine(pace: PlaylistPace, waiting: number, madeToday: number): string {
  const now = `Now ${PACE_IN_A_SENTENCE[pace]}.`;
  if (waiting === 0) return now;
  const limit = paceDailyLimit(pace);
  if (limit === 0) return `${now} The ${formatCount(waiting)} waiting stay until you choose them.`;
  if (limit === null) return `${now} The ${formatCount(waiting)} waiting carry on now.`;
  const tomorrow = Math.max(0, waiting - Math.max(0, limit - madeToday));
  return tomorrow === 0
    ? `${now} The ${formatCount(waiting)} waiting are made today.`
    : `${now} ${formatCount(tomorrow)} of the ${formatCount(waiting)} wait for tomorrow.`;
}

export function paceFacts(pace: PlaylistPace, waiting: number): string {
  return `${PACE_LABEL[pace]} · ${waiting === 0 ? "nothing waiting" : `${formatCount(waiting)} waiting`}`;
}

export function paceInASentence(pace: PlaylistPace): string {
  return PACE_IN_A_SENTENCE[pace];
}
