// One hit of the search term inside one block, at character offsets into that block's
// own text. The index is the hit's place in the whole transcript's run of hits, which is
// what the "3/4" counter and the ↑ ↓ steppers move through.
export interface TranscriptMatch {
  index: number;
  blockIndex: number;
  start: number;
  end: number;
}
