export const generationKeys = {
  all: ["generation"] as const,
  ourKeyStatus: (apiUrl: string | null) => [...generationKeys.all, "ourKeyStatus", apiUrl] as const,
  // Keyed by account, so signing in as someone else asks again.
  usage: (accountId: string | null) => [...generationKeys.all, "usage", accountId] as const,
};
