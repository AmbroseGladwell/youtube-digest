export const chatKeys = {
  all: ["chat"] as const,
  list: (overviewId: string) => [...chatKeys.all, "list", overviewId] as const,
  // The Ask drawer's conversations: the library's, every project's and every overview's (OV-363).
  asked: () => [...chatKeys.all, "asked"] as const,
  usage: (accountId: string | null) => [...chatKeys.all, "usage", accountId] as const,
};
