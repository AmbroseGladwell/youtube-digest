export const TRANSCRIPT_REST_GAP = 12;

// Why it's measured off the head: docs/features/reading-position.md, "Where a block comes to rest".
export const transcriptRestingLine = (head: HTMLElement): number => {
  return parseFloat(getComputedStyle(head).top) + head.offsetHeight + TRANSCRIPT_REST_GAP;
};
