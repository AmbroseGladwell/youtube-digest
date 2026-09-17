import type { OverviewId } from "@overview/types";

export const overviewKeys = {
  all: ["overview"] as const,
  lists: ["overview", "list"] as const,
  list: () => [...overviewKeys.lists] as const,
  detail: (overviewId: OverviewId) => [...overviewKeys.all, "detail", overviewId] as const,
};
