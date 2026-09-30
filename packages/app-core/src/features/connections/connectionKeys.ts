export const connectionKeys = {
  all: ["connections"] as const,
  request: (requestId: string) => [...connectionKeys.all, "request", requestId] as const,
  list: (account: string | null) => [...connectionKeys.all, "list", { account }] as const,
};
