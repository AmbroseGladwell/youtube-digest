// What each plan gives, written once (docs/architecture/tiers.md, design 95d–95h). The paid
// plans sell volume, never features: sync, narration with every voice and the MCP connection
// all belong to the free account, so what a reader runs out of is overviews.

export const EVERY_ACCOUNT_INCLUDES = [
  "Your library synced to the web app and every device",
  "Overviews read aloud, in every voice",
  "An MCP connection, so Claude and other assistants can read your overviews",
];

export interface PlanCard {
  name: string;
  ourKey: string;
  ownKey: string;
  note: string;
}

export const PLAN_CARDS: PlanCard[] = [
  {
    name: "Free",
    ourKey: "5 a month",
    ownKey: "10 a month",
    note: "Comes with every account.",
  },
  {
    name: "BYO Plus",
    ourKey: "10 a month",
    ownKey: "200 a month",
    note: "Cheaper, for a reader who already pays an AI provider.",
  },
  {
    name: "Plus",
    ourKey: "50 a month",
    ownKey: "200 a month",
    note: "For a reader who would rather not hold a key at all.",
  },
];
