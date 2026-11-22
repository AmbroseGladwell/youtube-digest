import type { LimitMessage } from "../../newOverview/util/limitMessage.js";
import type { QueueHold } from "../types/QueueHold.js";

const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const OR = new Intl.ListFormat("en-GB", { style: "long", type: "disjunction" });

export type MonthHoldWay = "addKey" | "seePlans";

// The month resets at UTC midnight, said on the reader's own calendar.
export const monthResumeDate = (hold: QueueHold, narrow = false): string => (narrow ? SHORT : LONG).format(new Date(hold.resumesAt));

export const monthHoldWays = (limit: LimitMessage | null): MonthHoldWay[] => [
  ...(limit?.actions.includes("addKey") ? (["addKey"] as const) : []),
  ...(limit?.actions.some((action) => action === "seePlans" || action === "seeByoPlus") ? (["seePlans"] as const) : []),
];

const madeSentence = (limit: LimitMessage | null) =>
  limit === null ? "This month's overviews are made" : `This month's ${limit.made} are made`;

export const monthHoldStripMeta = (hold: QueueHold, limit: LimitMessage | null, compact: boolean): string => {
  const withKey = monthHoldWays(limit).includes("addKey");
  if (compact) {
    return withKey
      ? `Resumes ${monthResumeDate(hold, true)} or with a key`
      : `${madeSentence(limit)} · resumes ${monthResumeDate(hold, true)}`;
  }
  return `${madeSentence(limit)}. Resumes ${monthResumeDate(hold)}${withKey ? ", or when you add a key" : ""}.`;
};

export const monthHoldNote = (hold: QueueHold, limit: LimitMessage | null): string => {
  const ways = monthHoldWays(limit);
  const when = [
    `on ${monthResumeDate(hold)}`,
    ...(ways.includes("addKey") ? ["as soon as you add a key"] : []),
    ...(ways.includes("seePlans") ? ["if your plan changes"] : []),
  ];
  return `${madeSentence(limit)}, so the queue is waiting. It carries on by itself ${OR.format(when)}.`;
};
