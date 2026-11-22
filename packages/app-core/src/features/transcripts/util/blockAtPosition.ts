// -1 before the first block; the position is the player's own measurement, never an estimate.
export const blockAtPosition = (blocks: { startMs: number }[], positionMs: number): number => {
  let current = -1;
  for (const [index, block] of blocks.entries()) {
    if (block.startMs > positionMs) {
      break;
    }
    current = index;
  }
  return current;
};
