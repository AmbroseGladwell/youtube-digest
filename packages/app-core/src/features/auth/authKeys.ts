export const authKeys = {
  all: ["auth"] as const,
  session: (account: string | null) => [...authKeys.all, "session", { account }] as const,
};
