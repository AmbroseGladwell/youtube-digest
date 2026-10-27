import type { LimitMessage } from "../../newOverview/util/limitMessage.js";
import type { QueueHold } from "../types/QueueHold.js";

const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const OR = new Intl.ListFormat("en-GB", { style: "long", type: "disjunction" });

export type MonthHoldWay = "addKey" | "seePlans";

// The month resets at UTC midnight, said on the reader's own calendar.
export const monthResumeDate = (hold: QueueHold, narrow = false): string =>
  (narrow ? SHORT : LONG).format(new Date(hold.resumesAt));

// The ways round the month's limit the queue offers: a key where one would give more, the
// plans where one would, and nothing where neither would (design 95p).
export const monthHoldWays = (limit: LimitMessage | null): MonthHoldWay[] => [
  ...(limit?.actions.includes("addKey") ? (["addKey"] as const) : []),
  ...(limit?.actions.some((action) => action === "seePlans" || action === "seeByoPlus") ? (["seePlans"] as const) : []),
];

const madeSentence = (limit: LimitMessage | null) =>
  limit === null ? "This month's overviews are made" : `This month's ${limit.made} are made`;

// Designs 95p and 95r: the strip, wide and compact.
export function monthHoldStripMeta(hold: QueueHold, limit: LimitMessage | null, compact: boolean): string {
  const withKey = monthHoldWays(limit).includes("addKey");
  if (compact) {
    return withKey ? `Resumes ${monthResumeDate(hold, true)} or with a key` : `${madeSentence(limit)} · resumes ${monthResumeDate(hold, true)}`;
  }
  return `${madeSentence(limit)}. Resumes ${monthResumeDate(hold)}${withKey ? ", or when you add a key" : ""}.`;
}

// Design 95q: the note above the queue's list.
export function monthHoldNote(hold: QueueHold, limit: LimitMessage | null): string {
  const ways = monthHoldWays(limit);
  const when = [
    `on ${monthResumeDate(hold)}`,
    ...(ways.includes("addKey") ? ["as soon as you add a key"] : []),
    ...(ways.includes("seePlans") ? ["if your plan changes"] : []),
  ];
  return `${madeSentence(limit)}, so the queue is waiting. It carries on by itself ${OR.format(when)}.`;
}
