// index counts hits across the whole transcript; start and end are offsets into the block's text.
export interface TranscriptMatch {
  index: number;
  blockIndex: number;
  start: number;
  end: number;
}
