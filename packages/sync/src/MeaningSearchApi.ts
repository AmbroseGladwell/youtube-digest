import type { MeaningSearchResponse } from "@overview/domain";

export interface MeaningSearchApi {
  search(query: string): Promise<MeaningSearchResponse>;
}
