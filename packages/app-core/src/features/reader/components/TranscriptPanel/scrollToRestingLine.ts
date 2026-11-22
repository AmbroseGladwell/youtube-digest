import { transcriptRestingLine } from "./transcriptRestingLine.js";

// Why instant, not smooth: docs/features/following-playback.md, "Following, and stopping following".
export const scrollToRestingLine = (element: HTMLElement, head: HTMLElement): void => {
  const top = window.scrollY + element.getBoundingClientRect().top - transcriptRestingLine(head);
  window.scrollTo({ top, behavior: "instant" });
};
