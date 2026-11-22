import { MAX_CHAT_QUESTIONS, type Plan } from "@overview/domain";
import { resetDate } from "../../newOverview/util/usageLine.js";
import { CHAT_UPSELL, chatUpsellLabel } from "./chatMeterOf.js";
import type { ChatWait } from "./chatWaitOf.js";

export type ShownWait = Exclude<ChatWait, { kind: "noSource" }> | { kind: "offline" };

export interface WaitCopy {
  icon: "clock" | "chat" | "wifiOff";
  heading: string;
  body: string;
  // Only routes that exist (OV-104): a month's upsell names only plans that give more.
  action: { kind: "seePlans" | "seePlus"; label: string } | { kind: "newConversation"; label: string } | null;
}

const more = (back: string | null) => (back === null ? "More next month." : `More on ${resetDate(back)}.`);
const until = (back: string | null) => (back === null ? " this month" : ` until ${resetDate(back)}`);

const plansAction = (plan: Plan): WaitCopy["action"] => {
  const upsell = CHAT_UPSELL[plan];
  return upsell === null ? null : { kind: upsell, label: chatUpsellLabel(upsell) };
};

// Design 310ad–310ah: what a wait in the field's place says (docs/features/chats.md, "Waits").
export const chatWaitCopy = (wait: ShownWait, plan: Plan, resetsOn: string | null): WaitCopy => {
  switch (wait.kind) {
    case "month":
      return {
        icon: "clock",
        heading: "You’ve used this month’s chat",
        body: `${more(wait.resetsOn ?? resetsOn)} Your overviews, and everything you’ve saved, keep working.`,
        action: plansAction(plan),
      };
    case "libraryMonth":
      return {
        icon: "clock",
        heading: "Not enough chat left for a library question",
        body: `A question across your library needs more than you have left this month. Questions about one overview still work${until(wait.resetsOn ?? resetsOn)}.`,
        action: plansAction(plan),
      };
    case "day":
      return {
        icon: "clock",
        heading: "That’s the most chat for one day",
        body: "Ask again tomorrow. The rest of this month’s chat is still yours.",
        action: null,
      };
    case "everyone":
      return {
        icon: "clock",
        heading: "Chat is paused for everyone today",
        body: "So many readers asked today that we’ve hit our own limit. Ask again tomorrow. Your allowance isn’t touched.",
        action: null,
      };
    case "conversationFull":
      return {
        icon: "chat",
        heading: `This conversation has ${MAX_CHAT_QUESTIONS} questions, the most one can hold.`,
        body: "Start a new one. It can see this one.",
        action: { kind: "newConversation", label: "New conversation" },
      };
    case "offline":
      return { icon: "wifiOff", heading: "You’re offline", body: "Ask again when you’re back online.", action: null };
  }
};
