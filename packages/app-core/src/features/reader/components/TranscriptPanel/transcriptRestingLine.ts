export const TRANSCRIPT_REST_GAP = 12;

// Where a block scrolled to comes to rest: just under the panel's sticky head, which is
// the foot of the page's whole sticky stack. Taken off the head itself rather than summed
// from the chrome's custom properties, because the head grows when the transcript arrives
// and a sum read before that lands the block behind it. The head's own `top` is where it
// will come to rest whether or not it is stuck yet, so this holds at the top of the page
// as well as part-way down it.
export function transcriptRestingLine(head: HTMLElement): number {
  return parseFloat(getComputedStyle(head).top) + head.offsetHeight + TRANSCRIPT_REST_GAP;
}
