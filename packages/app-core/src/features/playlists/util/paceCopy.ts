import { paceDailyLimit, type PlaylistPace } from "@overview/domain";
import { formatCount } from "./tokenEstimate.js";
import { resetDate } from "../../newOverview/util/usageLine.js";

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

export const paceSpan = (days: number): string => {
  if (days <= 1) {
    return "a day";
  }
  if (days <= DAYS_BEFORE_MONTHS) {
    return `${formatCount(days)} days`;
  }
  return `${formatCount(Math.round(days / MONTH_DAYS))} months`;
};

// docs/features/playlists.md, "The preview".
export const paceConsequence = (pace: PlaylistPace, toMake: number, backfill: boolean): string => {
  const limit = paceDailyLimit(pace);
  if (limit === 0) {
    return backfill && toMake > 0
      ? `All ${formatCount(toMake)} wait in the queue until you choose them, and use none of your allowance until then.`
      : "New videos wait in the queue until you choose them, and use none of your allowance until then.";
  }
  if (!backfill || toMake === 0) {
    return limit === null ? "New videos from it are made as they arrive." : `New videos from it are made up to ${limit} a day.`;
  }
  if (limit === null) {
    return `All ${formatCount(toMake)} are made one after another, until this month’s allowance runs out.`;
  }
  if (toMake <= limit) {
    return `All ${formatCount(toMake)} today, then up to ${limit} a day as new ones arrive.`;
  }
  return `${formatCount(toMake)} videos at ${limit} a day: about ${paceSpan(Math.ceil(toMake / limit))}.`;
};

export const paceWaitEffect = (pace: PlaylistPace, waiting: number): string => {
  if (waiting === 0) {
    return paceConsequence(pace, 0, false);
  }
  const limit = paceDailyLimit(pace);
  if (limit === 0) {
    return `The ${formatCount(waiting)} waiting stay until you choose them`;
  }
  if (limit === null) {
    return `The ${formatCount(waiting)} waiting carry on now`;
  }
  if (waiting <= limit) {
    return `The ${formatCount(waiting)} waiting are made today`;
  }
  return `${formatCount(waiting)} waiting at ${limit} a day: about ${paceSpan(Math.ceil(waiting / limit))}`;
};

export const paceChangedLine = (pace: PlaylistPace, waiting: number, madeToday: number): string => {
  const now = `Now ${PACE_IN_A_SENTENCE[pace]}.`;
  if (waiting === 0) {
    return now;
  }
  const limit = paceDailyLimit(pace);
  if (limit === 0) {
    return `${now} The ${formatCount(waiting)} waiting stay until you choose them.`;
  }
  if (limit === null) {
    return `${now} The ${formatCount(waiting)} waiting carry on now.`;
  }
  const tomorrow = Math.max(0, waiting - Math.max(0, limit - madeToday));
  return tomorrow === 0
    ? `${now} The ${formatCount(waiting)} waiting are made today.`
    : `${now} ${formatCount(tomorrow)} of the ${formatCount(waiting)} wait for tomorrow.`;
};

export const paceInASentence = (pace: PlaylistPace): string => {
  return PACE_IN_A_SENTENCE[pace];
};

// Null when the allowance covers the lot, or when nothing here would spend it (95s, 95v).
export const allowanceLine = (pace: PlaylistPace | null, toMake: number, left: number, resetsOn: string): string | null => {
  const limit = pace === null ? null : paceDailyLimit(pace);
  if (limit === 0 || toMake <= left) {
    return null;
  }
  const rest = formatCount(toMake - left);
  const date = resetDate(resetsOn);
  if (left === 0) {
    return `Nothing is left of this month’s allowance, so all ${formatCount(toMake)} wait in the queue and carry on by themselves on ${date}.`;
  }
  if (limit === null) {
    return `${formatCount(left)} of these ${formatCount(toMake)} can be made now: you have ${formatCount(left)} left this month. The other ${rest} wait in the queue and carry on by themselves on ${date}.`;
  }
  const days = Math.ceil(left / limit);
  const span = days === 1 ? "today" : `the next ${formatCount(days)} days`;
  return `Your allowance covers ${formatCount(left)} more this month. At ${limit} a day that’s ${span}; the other ${rest} wait for ${date}, then carry on at ${limit} a day.`;
};
