import type { KeySource, Plan } from "@overview/domain";
import type { NextQuota } from "./nextQuota.js";

const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const CHECKING = "Checking…";

export const resetDate = (resetsOn: string, narrow = false): string =>
  (narrow ? SHORT : LONG).format(new Date(`${resetsOn}T00:00:00Z`));

export const leftOf = (left: number, limit: number): string => `${left} of ${limit} left`;

const ON_KEY: Record<KeySource, string> = { ours: "on us", own: "on your own key" };

const PLUS_UPSELL = "Get more overviews with Plus";

export interface UsageLine {
  parts: string[];
  // The link to Settings › Plan the line ends with, if any. The panel leaves it out, unless
  // the line has a plan to mention.
  link: "Plan" | "See plans" | null;
}

export interface UsageLineOptions {
  narrow?: boolean;
  plan?: Plan | null;
}

// Design 95b, and 95c where it's narrow, with the key order flipped for everyone but Plus
// (decided on OV-131): only the quota the next overview will use. Falling back to our key on
// Free or BYO Plus, it mentions Plus once (95m): an upsell names only a plan that makes more
// on the key this overview uses (decided on OV-131).
export function usageLineOf(next: NextQuota, { narrow = false, plan = null }: UsageLineOptions = {}): UsageLine {
  const planLink = narrow ? null : "Plan";
  switch (next.kind) {
    case "checking":
      return { parts: [`${narrow ? "Left" : "Overviews left"} this month: ${CHECKING}`], link: planLink };
    case "unreachable":
      return { parts: ["Couldn't check what's left"], link: planLink };
    case "trial": {
      const left = `${next.left} of ${next.total} trial overviews left`;
      return { parts: narrow ? [left] : [left, "On either key"], link: planLink };
    }
    case "spent":
      return { parts: ["None left this month", `More on ${resetDate(next.resetsOn, narrow)}`], link: planLink };
    case "quota": {
      const left = leftOf(next.left, next.limit);
      if (next.passedOver !== null) {
        const { key: spentKey, limit: spentLimit } = next.passedOver;
        const uses = `${next.key === "ours" ? "is on us" : "uses your own key"}: ${left}.`;
        const sentence = narrow
          ? `${spentKey === "ours" ? `The ${spentLimit} on us are` : `Your key's ${spentLimit} are`} made this month. This one ${uses}`
          : `This month's ${spentLimit} ${ON_KEY[spentKey]} are made, so this one ${uses}`;
        if (next.key === "ours" && plan !== "plus") {
          return narrow
            ? { parts: [`${sentence} ${PLUS_UPSELL}`], link: "Plan" }
            : { parts: [sentence, PLUS_UPSELL], link: "See plans" };
        }
        return { parts: [sentence], link: planLink };
      }
      return narrow
        ? { parts: [`${left} ${ON_KEY[next.key]}`, `Resets ${resetDate(next.resetsOn, true)}`], link: planLink }
        : { parts: [`${left} ${ON_KEY[next.key]} this month`, `Resets ${resetDate(next.resetsOn)}`], link: planLink };
    }
  }
}

// The Settings row beside Plan: the plan, and what's left of the next quota (design 95d).
export function planRowCount(next: NextQuota | null): string | null {
  if (next === null) return null;
  switch (next.kind) {
    case "checking":
      return CHECKING;
    case "unreachable":
      return null;
    case "trial":
    case "quota":
      return leftOf(next.left, next.kind === "trial" ? next.total : next.limit);
    case "spent":
      return "None left this month";
  }
}
