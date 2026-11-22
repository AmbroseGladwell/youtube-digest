import type { ChatScopeStats } from "@overview/domain";

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// OV-354, page 4: the line under an Ask answer, from the counts code made when it was answered,
// never from the answer's words. "From 5 of your 208 overviews".
export const askStatsLine = (stats: ChatScopeStats, scope: "library" | "project"): string => {
  const whole = scope === "library" ? `your ${overviews(stats.overviews)}` : `this project's ${overviews(stats.overviews)}`;
  return stats.read === undefined ? `Over ${whole}` : `From ${stats.read} of ${whole}`;
};
