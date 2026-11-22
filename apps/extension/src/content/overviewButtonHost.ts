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

// docs/features/injected-button.md, "Placing it in a row that keeps moving".
export const findOverviewButtonHost = (): HTMLElement | null => {
  for (const actionRow of document.querySelectorAll("ytd-watch-metadata #actions-inner")) {
    if (!isVisible(actionRow)) {
      continue;
    }
    const group = Array.from(actionRow.querySelectorAll("#top-level-buttons-computed")).find(isVisible);
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
        isVisible(candidate) && (candidate.closest("ytd-watch-metadata") !== null || candidate.closest("#primary") !== null),
    ) ?? null
  );
};
