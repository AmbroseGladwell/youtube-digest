export const chatKeys = {
  all: ["chat"] as const,
  list: (overviewId: string) => [...chatKeys.all, "list", overviewId] as const,
  // The Ask page's conversations: the library's and every project's (OV-354).
  asked: () => [...chatKeys.all, "asked"] as const,
  usage: (accountId: string | null) => [...chatKeys.all, "usage", accountId] as const,
};
