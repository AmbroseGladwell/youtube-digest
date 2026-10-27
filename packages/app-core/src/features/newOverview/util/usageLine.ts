import type { KeySource } from "@overview/domain";
import type { NextQuota } from "./nextQuota.js";

const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const CHECKING = "Checking…";

export const resetDate = (resetsOn: string, narrow = false): string =>
  (narrow ? SHORT : LONG).format(new Date(`${resetsOn}T00:00:00Z`));

export const leftOf = (left: number, limit: number): string => `${left} of ${limit} left`;

const ON_KEY: Record<KeySource, string> = { ours: "on our key", own: "on your own key" };

export interface UsageLine {
  parts: string[];
  // Whether the line ends with Plan, a link to Settings › Plan. The panel leaves it out.
  planLink: boolean;
}

// Design 95b, and 95c where it's narrow, with the key order flipped for everyone but Plus
// (decided on OV-131): only the quota the next overview will use.
export function usageLineOf(next: NextQuota, narrow = false): UsageLine {
  const planLink = !narrow;
  switch (next.kind) {
    case "checking":
      return { parts: [`${narrow ? "Left" : "Overviews left"} this month: ${CHECKING}`], planLink };
    case "unreachable":
      return { parts: ["Couldn't check what's left"], planLink };
    case "trial": {
      const left = `${next.left} of ${next.total} trial overviews left`;
      return { parts: narrow ? [left] : [left, "On either key"], planLink };
    }
    case "spent":
      return { parts: ["None left this month", `More on ${resetDate(next.resetsOn, narrow)}`], planLink };
    case "quota": {
      const left = leftOf(next.left, next.limit);
      if (next.passedOver !== null) {
        const { key: spentKey, limit: spentLimit } = next.passedOver;
        const uses = `uses ${next.key === "ours" ? "ours" : "your own key"}: ${left}.`;
        const sentence = narrow
          ? `${spentKey === "ours" ? "Our key's" : "Your key's"} ${spentLimit} are made this month. This one ${uses}`
          : `This month's ${spentLimit} ${ON_KEY[spentKey]} are made, so this one ${uses}`;
        return { parts: [sentence], planLink };
      }
      return narrow
        ? { parts: [`${left} ${ON_KEY[next.key]}`, `Resets ${resetDate(next.resetsOn, true)}`], planLink }
        : { parts: [`${left} ${ON_KEY[next.key]} this month`, `Resets ${resetDate(next.resetsOn)}`], planLink };
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
