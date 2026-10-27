export const generationKeys = {
  all: ["generation"] as const,
  ourKeyStatus: (apiUrl: string | null) => [...generationKeys.all, "ourKeyStatus", apiUrl] as const,
  allUsage: () => [...generationKeys.all, "usage"] as const,
  // Keyed by account, so signing in as someone else asks again.
  usage: (accountId: string | null) => [...generationKeys.allUsage(), accountId] as const,
};
