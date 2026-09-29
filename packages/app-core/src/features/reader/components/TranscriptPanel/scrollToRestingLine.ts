import { transcriptRestingLine } from "./transcriptRestingLine.js";

// Instant rather than smooth on purpose: the follow reads the current row leaving the
// viewport as the reader taking over, and a scroll still in flight would trip it
// (docs/features/following-playback.md).
export function scrollToRestingLine(element: HTMLElement, head: HTMLElement): void {
  const top = window.scrollY + element.getBoundingClientRect().top - transcriptRestingLine(head);
  window.scrollTo({ top, behavior: "instant" });
}
