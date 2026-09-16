export const overviewKeys = {
  all: ["overview"] as const,
  lists: ["overview", "list"] as const,
  list: () => [...overviewKeys.lists] as const,
};
