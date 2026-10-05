// The card's figure for one overview on the reader's own key. Every number that reaches the
// reader is multiplied from this in code, never estimated by a model
// (docs/prototype/constraints.md, docs/features/playlists.md, "The preview").
export const TOKENS_PER_OVERVIEW = 30_000;

export const tokenEstimate = (overviews: number): number => overviews * TOKENS_PER_OVERVIEW;

export const formatCount = (count: number): string => count.toLocaleString("en-GB");

export function tokensText(tokens: number): string {
  return tokens >= 1_000_000 ? `${Math.round(tokens / 100_000) / 10} million` : formatCount(tokens);
}
