import type { KeySource, LimitQuota, Plan } from "@overview/domain";
import { PLAN_CARDS } from "../../plus/planCards.js";
import type { NextQuota, SpentQuota } from "./nextQuota.js";
import { resetDate } from "./usageLine.js";

export type LimitAction = "createAccount" | "addKey" | "seePlans" | "seeByoPlus" | "seeUsage";

export interface LimitMessage {
  quota: LimitQuota;
  // What ran out, for a sentence that says it was made: "10 on your own key and 5 on ours".
  made: string;
  title: string;
  body: string;
  actions: LimitAction[];
}

export const LIMIT_FOOT = "Everything you've already made keeps working.";

export const LIMIT_ACTION_LABEL: Record<LimitAction, string> = {
  createAccount: "Create account",
  addKey: "Add your own key",
  seePlans: "See plans",
  seeByoPlus: "See BYO Plus",
  seeUsage: "See this month's usage",
};

const card = (name: string) => PLAN_CARDS.find((plan) => plan.name === name)!;
const FREE = card("Free");
const BYO_PLUS = card("BYO Plus");
const PLUS = card("Plus");
const OWN_KEY_MONTH: Record<Plan, string> = { free: FREE.ownKey, "byo-plus": BYO_PLUS.ownKey, plus: PLUS.ownKey };
const PLAN_NAME: Record<Plan, string> = { free: "your free account", "byo-plus": "BYO Plus", plus: "Plus" };

const onKey = (key: KeySource, first: boolean): string =>
  key === "ours" ? (first ? "on our key" : "on ours") : first ? "on your own key" : "on your own";

function madePhrase(spent: SpentQuota[], plainOurs: boolean): string {
  const [first, second] = spent;
  if (second !== undefined) return `${first!.limit} ${onKey(first!.key, true)} and ${second.limit} ${onKey(second.key, false)}`;
  return plainOurs ? `${first!.limit}` : `${first!.limit} ${onKey(first!.key, true)}`;
}

// What ran out, when it's back, and only the ways round it that exist (designs 95i–95o, with
// the key order flipped for everyone but Plus, decided on OV-131; docs/architecture/tiers.md,
// "At the limit"). Null while there is still a quota to use.
export function limitMessageOf(next: NextQuota | null, plan: Plan): LimitMessage | null {
  if (next?.kind === "trial") {
    if (next.left > 0) return null;
    return {
      quota: "trial",
      made: `${next.total} trial overviews`,
      title: `You've used your ${next.total} trial overviews`,
      body: `A free account makes ${FREE.ourKey} on our key, syncs them to every device and reads them aloud.`,
      actions: ["createAccount"],
    };
  }
  if (next?.kind !== "spent") return null;

  const { spent, resetsOn } = next;
  const keys = new Set(spent.map((quota) => quota.key));
  const quota: LimitQuota = keys.size === 2 ? "both" : keys.has("ours") ? "ours" : "own";
  const made = madePhrase(spent, quota === "ours" && plan !== "plus");
  const title = `You've made this month's ${made}. More on ${resetDate(resetsOn)}.`;

  if (quota === "ours") {
    return plan === "plus"
      ? { quota, made, title, body: `Add your own key and carry on: Plus makes ${PLUS.ownKey} with it.`, actions: ["addKey"] }
      : {
          quota,
          made,
          title,
          body: `Plus makes more each month on our key. Or add your own key: ${PLAN_NAME[plan]} makes ${OWN_KEY_MONTH[plan]} with it.`,
          actions: ["addKey", "seePlans"],
        };
  }
  if (plan === "free") {
    return { quota, made, title, body: `BYO Plus makes ${BYO_PLUS.ownKey} on your own key.`, actions: ["seeByoPlus"] };
  }
  if (plan === "byo-plus" && quota === "both") {
    return { quota, made, title, body: `Plus makes ${PLUS.ourKey} on our key.`, actions: ["seePlans"] };
  }
  return {
    quota,
    made,
    title,
    body: "That's the most any plan makes on your own key, so there's no upgrade for this.",
    actions: ["seeUsage"],
  };
}
