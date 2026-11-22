import type { TranscriptSearchResponse } from "@overview/domain";

export interface TranscriptSearchApi {
  search(query: string): Promise<TranscriptSearchResponse>;
}
