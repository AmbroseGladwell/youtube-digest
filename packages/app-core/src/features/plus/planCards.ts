import { chatAllowances } from "@overview/domain";

// Paid plans sell volume, never features: docs/architecture/tiers.md, "The tiers".

export const EVERY_ACCOUNT_INCLUDES = [
  "Your library synced to the web app and every device",
  "Overviews read aloud, in every voice",
  "An MCP connection, so Claude and other assistants can read your overviews",
];

export interface PlanCard {
  name: string;
  price: string;
  ourKey: string;
  ownKey: string;
  questions: string;
  transcribing: string;
  note: string;
}

export const PLAN_CARDS: PlanCard[] = [
  {
    name: "Free",
    price: "£0",
    ourKey: "5 a month",
    ownKey: "10 a month",
    questions: `${chatAllowances.free.toLocaleString("en-GB")} a month`,
    transcribing: "5 hr a month",
    note: "Comes with every account.",
  },
  {
    name: "BYO Plus",
    price: "£4.99 a month",
    ourKey: "10 a month",
    ownKey: "200 a month",
    questions: `${chatAllowances["byo-plus"].toLocaleString("en-GB")} a month`,
    transcribing: "15 hr a month",
    note: "Cheaper, for a reader who already pays an AI provider.",
  },
  {
    name: "Plus",
    price: "£7.99 a month",
    ourKey: "50 a month",
    ownKey: "200 a month",
    questions: `${chatAllowances.plus.toLocaleString("en-GB")} a month`,
    transcribing: "30 hr a month",
    note: "For a reader who would rather not hold a key at all.",
  },
];
