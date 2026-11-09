import type { MeaningSearchResponse } from "@overview/domain";

// Overviews close in meaning to a search, from the reader's own library on our server
// (docs/features/search-by-meaning.md, "The route").
export interface MeaningSearchApi {
  search(query: string): Promise<MeaningSearchResponse>;
}
