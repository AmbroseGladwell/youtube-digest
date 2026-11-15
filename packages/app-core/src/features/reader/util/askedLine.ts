import { FOLLOW_UP_ASSISTANTS, type AskedQuestion } from "@overview/domain";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Design 266aj: which assistant a question was taken to, and how long ago.
export function askedLine({ assistant, askedAt }: AskedQuestion, now: Date): string {
  const elapsed = now.getTime() - new Date(askedAt).getTime();
  const format = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  const when =
    elapsed < MINUTE_MS
      ? "just now"
      : elapsed < HOUR_MS
        ? format.format(-Math.floor(elapsed / MINUTE_MS), "minute")
        : elapsed < DAY_MS
          ? format.format(-Math.floor(elapsed / HOUR_MS), "hour")
          : format.format(-Math.floor(elapsed / DAY_MS), "day");
  return `Asked in ${FOLLOW_UP_ASSISTANTS[assistant].name} · ${when}`;
}
