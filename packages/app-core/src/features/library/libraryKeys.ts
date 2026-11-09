export const libraryKeys = {
  all: ["library"] as const,
  meaning: (apiUrl: string | null, accountId: string | null, query: string) =>
    [...libraryKeys.all, "meaning", { apiUrl, accountId, query }] as const,
};
