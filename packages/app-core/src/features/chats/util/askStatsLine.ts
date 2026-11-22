import type { ChatScopeStats } from "@overview/domain";

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// The line under an Ask answer, from code's counts (docs/features/chats.md, "The Ask page").
export const askStatsLine = (stats: ChatScopeStats, scope: "library" | "project"): string => {
  const whole = scope === "library" ? `your ${overviews(stats.overviews)}` : `this project's ${overviews(stats.overviews)}`;
  if (stats.looked !== undefined) {
    const across = stats.looked === stats.overviews ? whole : `${stats.looked} of ${whole}`;
    return stats.read === undefined || stats.read === 0
      ? `Looked across ${across}`
      : `Looked across ${across} · read ${stats.read} in full`;
  }
  return stats.read === undefined ? `Over ${whole}` : `From ${stats.read} of ${whole}`;
};
