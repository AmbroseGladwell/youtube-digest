export const chatKeys = {
  all: ["chat"] as const,
  list: (overviewId: string) => [...chatKeys.all, "list", overviewId] as const,
  usage: (accountId: string | null) => [...chatKeys.all, "usage", accountId] as const,
};
