import { MAX_CHAT_QUESTIONS, chatAllowances, type Plan } from "@overview/domain";
import { resetDate } from "../../newOverview/util/usageLine.js";
import type { ChatWait } from "./chatWaitOf.js";

export type ShownWait = Exclude<ChatWait, { kind: "noSource" }> | { kind: "offline" };

export interface WaitCopy {
  icon: "clock" | "chat" | "wifiOff";
  heading: string;
  body: string;
  // Only routes that exist (OV-104): a month's upsell names only plans that give more.
  action: { kind: "seePlans" | "seePlus"; label: string } | { kind: "newConversation"; label: string } | null;
}

const count = (value: number) => value.toLocaleString("en-GB");
const NOT_OVERVIEWS = "Making overviews isn’t affected.";

// Design 310ad–310ah: what a wait in the field's place says (docs/features/chats.md, "Waits").
export const chatWaitCopy = (wait: ShownWait, plan: Plan, resetsOn: string | null): WaitCopy => {
  switch (wait.kind) {
    case "month": {
      const back = wait.resetsOn ?? resetsOn;
      const more = back === null ? "More next month." : `More on ${resetDate(back)}.`;
      const heading = `You’ve asked this month’s ${count(chatAllowances[plan])} questions on us`;
      if (plan === "free") {
        return {
          icon: "clock",
          heading,
          body: `${more} BYO Plus gives ${count(chatAllowances["byo-plus"])} a month, Plus ${count(chatAllowances.plus)}. ${NOT_OVERVIEWS}`,
          action: { kind: "seePlans", label: "See plans" },
        };
      }
      if (plan === "byo-plus") {
        return {
          icon: "clock",
          heading,
          body: `${more} Plus gives ${count(chatAllowances.plus)} a month. ${NOT_OVERVIEWS}`,
          action: { kind: "seePlus", label: "See Plus" },
        };
      }
      return { icon: "clock", heading, body: `${more} ${NOT_OVERVIEWS}`, action: null };
    }
    case "day":
      return {
        icon: "clock",
        heading: "That’s the most questions for one day",
        body: "Ask again tomorrow. The rest of this month’s questions are still yours.",
        action: null,
      };
    case "everyone":
      return {
        icon: "clock",
        heading: "Questions are paused for everyone today",
        body: "So many readers asked today that we’ve hit our own limit. Ask again tomorrow.",
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
