// Every figure the reader sees is multiplied from this in code: docs/features/playlists.md, "The preview".
export const TOKENS_PER_OVERVIEW = 30_000;

export const tokenEstimate = (overviews: number): number => overviews * TOKENS_PER_OVERVIEW;

export const formatCount = (count: number): string => count.toLocaleString("en-GB");

export const tokensText = (tokens: number): string => {
  return tokens >= 1_000_000 ? `${Math.round(tokens / 100_000) / 10} million` : formatCount(tokens);
};
