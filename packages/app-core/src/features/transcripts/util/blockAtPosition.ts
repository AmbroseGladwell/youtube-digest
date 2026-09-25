// The block the player is inside, or the last one it has passed. -1 before the first
// block begins and for a transcript with no blocks at all. The position is the player's
// own measurement; nothing here estimates one (docs/features/following-playback.md).
// A chapter is a block of the video in the same sense, so the list is anything timed.
export function blockAtPosition(blocks: { startMs: number }[], positionMs: number): number {
  let current = -1;
  for (const [index, block] of blocks.entries()) {
    if (block.startMs > positionMs) {
      break;
    }
    current = index;
  }
  return current;
}
