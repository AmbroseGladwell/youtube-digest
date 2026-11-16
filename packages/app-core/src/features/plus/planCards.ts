import { chatAllowances } from "@overview/domain";

// What each plan gives, written once (docs/architecture/tiers.md, design 95d–95h). The paid
// plans sell volume, never features: sync, narration with every voice, the MCP connection and
// chat all belong to the free account, so what a reader runs out of is overviews and questions.

export const EVERY_ACCOUNT_INCLUDES = [
  "Your library synced to the web app and every device",
  "Overviews read aloud, in every voice",
  "An MCP connection, so Claude and other assistants can read your overviews",
];

export interface PlanCard {
  name: string;
  ourKey: string;
  ownKey: string;
  // Questions about an overview a month, always on us (OV-310).
  questions: string;
  note: string;
}

export const PLAN_CARDS: PlanCard[] = [
  {
    name: "Free",
    ourKey: "5 a month",
    ownKey: "10 a month",
    questions: `${chatAllowances.free.toLocaleString("en-GB")} a month`,
    note: "Comes with every account.",
  },
  {
    name: "BYO Plus",
    ourKey: "10 a month",
    ownKey: "200 a month",
    questions: `${chatAllowances["byo-plus"].toLocaleString("en-GB")} a month`,
    note: "Cheaper, for a reader who already pays an AI provider.",
  },
  {
    name: "Plus",
    ourKey: "50 a month",
    ownKey: "200 a month",
    questions: `${chatAllowances.plus.toLocaleString("en-GB")} a month`,
    note: "For a reader who would rather not hold a key at all.",
  },
];
