const isVisible = (element: Element | null): element is HTMLElement => {
  if (!element || !element.isConnected) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
};

// YouTube keeps hidden copies of its responsive action toolbar in the DOM, so a plain
// querySelector can hand back a 0x0 one and the button lands somewhere nobody can see
// it. Every candidate is measured instead. Both this and the selector list are taken
// from the reference extension, which carries the scar
// (docs/features/injected-button.md).
export function findOverviewButtonHost(): HTMLElement | null {
  for (const actionRow of document.querySelectorAll("ytd-watch-metadata #actions-inner")) {
    if (!isVisible(actionRow)) {
      continue;
    }
    const group = Array.from(actionRow.querySelectorAll("#top-level-buttons-computed")).find(
      isVisible,
    );
    if (group) {
      return group;
    }
  }

  const fallbacks = document.querySelectorAll(
    "ytd-watch-metadata #actions #top-level-buttons-computed, " +
      "ytd-watch-metadata #top-level-buttons-computed, " +
      "#primary #actions #top-level-buttons-computed",
  );

  return (
    Array.from(fallbacks).find(
      (candidate): candidate is HTMLElement =>
        isVisible(candidate) &&
        (candidate.closest("ytd-watch-metadata") !== null ||
          candidate.closest("#primary") !== null),
    ) ?? null
  );
}
