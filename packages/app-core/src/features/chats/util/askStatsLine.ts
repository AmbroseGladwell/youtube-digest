import type { ChatScopeStats } from "@overview/domain";

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// OV-354, page 4: the line under an Ask answer, from the counts code made when it was answered,
// never from the answer's words. "From 5 of your 208 overviews"; since OV-373, what a planned answer
// looked across: "Looked across 112 of your 223 overviews · read 5 in full".
export function askStatsLine(stats: ChatScopeStats, scope: "library" | "project"): string {
  const whole = scope === "library" ? `your ${overviews(stats.overviews)}` : `this project's ${overviews(stats.overviews)}`;
  if (stats.looked !== undefined) {
    const across = stats.looked === stats.overviews ? whole : `${stats.looked} of ${whole}`;
    return stats.read === undefined || stats.read === 0
      ? `Looked across ${across}`
      : `Looked across ${across} · read ${stats.read} in full`;
  }
  return stats.read === undefined ? `Over ${whole}` : `From ${stats.read} of ${whole}`;
}
