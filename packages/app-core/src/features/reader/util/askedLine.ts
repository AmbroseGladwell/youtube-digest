import { FOLLOW_UP_ASSISTANTS, type AskedQuestion } from "@overview/domain";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const askedAgo = (askedAt: string, now: Date): string => {
  const elapsed = now.getTime() - new Date(askedAt).getTime();
  const format = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (elapsed < MINUTE_MS) {
    return "just now";
  }
  if (elapsed < HOUR_MS) {
    return format.format(-Math.floor(elapsed / MINUTE_MS), "minute");
  }
  if (elapsed < DAY_MS) {
    return format.format(-Math.floor(elapsed / HOUR_MS), "hour");
  }
  return format.format(-Math.floor(elapsed / DAY_MS), "day");
};

export const askedLine = ({ assistant, askedAt }: AskedQuestion, now: Date): string => {
  return `Asked in ${FOLLOW_UP_ASSISTANTS[assistant].name} · ${askedAgo(askedAt, now)}`;
};

export const answeredHereLine = (at: string, now: Date): string => `Answered here · ${askedAgo(at, now)}`;
