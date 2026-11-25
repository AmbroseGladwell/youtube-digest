import { PLAN_LABEL } from "./planLabel.js";
import { chatAllowances, overviewQuotas, saveQuotas, transcriptionHours, type Plan } from "@overview/domain";

// Paid plans sell volume, and suggested questions: docs/architecture/tiers.md, "The tiers".

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
  chat: string;
  transcribing: string;
  note: string;
}

const typicalQuestions = (count: number) => `About ${count.toLocaleString("en-GB")} typical questions a month`;

export const PLAN_CARDS: PlanCard[] = [
  {
    name: "Free",
    price: "£0",
    ourKey: "5 a month",
    ownKey: "10 a month",
    chat: typicalQuestions(chatAllowances.free),
    transcribing: "5 hr a month",
    note: "Comes with every account.",
  },
  {
    name: "BYO Plus",
    price: "£4.99 a month",
    ourKey: "10 a month",
    ownKey: "200 a month",
    chat: typicalQuestions(chatAllowances["byo-plus"]),
    transcribing: "15 hr a month",
    note: "Cheaper, for a reader who already pays an AI provider.",
  },
  {
    name: "Plus",
    price: "£7.99 a month",
    ourKey: "50 a month",
    ownKey: "200 a month",
    chat: typicalQuestions(chatAllowances.plus),
    transcribing: "30 hr a month",
    note: "For a reader who would rather not hold a key at all.",
  },
];

export type PaidPlan = Exclude<Plan, "free">;
export type Billing = "monthly" | "yearly";

export interface PlanOffer {
  plan: Plan;
  name: string;
  tagline: string;
  includes: string | null;
  benefits: string[];
}

export interface PaidPrice {
  monthly: string;
  yearlyPerMonth: string;
  billedYearly: string;
  saves: string;
}

// Launch prices, to be checked against costs before billing (owner, 25 Nov 2026; design 351j).
export const PAID_PRICES: Record<PaidPlan, PaidPrice> = {
  "byo-plus": { monthly: "£5.99", yearlyPerMonth: "£4.99", billedYearly: "£59.88", saves: "17%" },
  plus: { monthly: "£9.49", yearlyPerMonth: "£7.99", billedYearly: "£95.88", saves: "16%" },
};

export const YEARLY_SAVES_UP_TO = "17%";

const count = (value: number) => value.toLocaleString("en-GB");

// Every benefit each plan gives, as design 351j lists them; the figures are the server's own.
export const PLAN_OFFERS: Record<Plan, PlanOffer> = {
  free: {
    plan: "free",
    name: PLAN_LABEL.free,
    tagline: "For starting a knowledge library that organises itself",
    includes: null,
    benefits: [
      `${overviewQuotas.free.ours} overviews a month, on us`,
      `${overviewQuotas.free.own} more on your own AI key`,
      "A verdict on what’s worth your time",
      "Save from video, podcasts, any page",
      "Cooking mode for recipes",
      "Auto tags, topics and project ideas",
      `Ask your library, about ${count(chatAllowances.free)} a month*`,
      "Connect Claude and more via MCP",
      "Listen to any overview",
      "1-click overviews with the Chrome extension",
      `${transcriptionHours.free} hr of transcribing a month`,
      `${saveQuotas.free} saves a month, overview later`,
      "Share any overview with a link",
      "Synced to web and every device",
    ],
  },
  "byo-plus": {
    plan: "byo-plus",
    name: PLAN_LABEL["byo-plus"],
    tagline: "More for less if you already pay for AI",
    includes: "Everything in Free, plus:",
    benefits: [
      `${overviewQuotas["byo-plus"].ours} overviews a month, on us`,
      `${overviewQuotas["byo-plus"].own} more on your own AI key`,
      `About ${count(chatAllowances["byo-plus"])} questions a month*`,
      `${transcriptionHours["byo-plus"]} hr of transcribing a month`,
      "Suggested questions across your library",
    ],
  },
  plus: {
    plan: "plus",
    name: PLAN_LABEL.plus,
    tagline: "For a knowledge library with higher limits",
    includes: "Everything in BYO Plus, plus:",
    benefits: [
      `${overviewQuotas.plus.ours} overviews a month, on us`,
      `About ${count(chatAllowances.plus)} questions a month*`,
      `${transcriptionHours.plus} hr of transcribing a month`,
      `${saveQuotas.plus} saves a month, overview later`,
    ],
  },
};
