export const chatKeys = {
  all: ["chat"] as const,
  list: (overviewId: string) => [...chatKeys.all, "list", overviewId] as const,
  asked: () => [...chatKeys.all, "asked"] as const,
  every: () => [...chatKeys.all, "every"] as const,
  usage: (accountId: string | null) => [...chatKeys.all, "usage", accountId] as const,
  suggested: (projectId: string | null) => [...chatKeys.all, "suggested", { projectId }] as const,
};
