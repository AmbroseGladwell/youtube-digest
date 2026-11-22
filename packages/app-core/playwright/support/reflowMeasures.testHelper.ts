export const MOST_OF_THE_SCREEN_BARS_MAY_COVER = 0.5;
export const SMALLEST_GROWTH_AT_DOUBLED_TEXT = 1.5;
export const SMALLEST_SCROLL_WINDOW = 0.25;

export interface CoveringBar {
  bar: string;
  top: number;
  bottom: number;
}

export interface ScreenCover {
  share: number;
  bars: CoveringBar[];
}

export const measureBarCover = (): ScreenCover | null => {
  const scroller = document.scrollingElement ?? document.documentElement;
  if (scroller.scrollHeight <= innerHeight + 1) {
    return null;
  }
  const kept = scrollY;
  scrollTo(0, (scroller.scrollHeight - innerHeight) / 2);
  const overlay = "[role=dialog], [role=menu], [role=listbox], [aria-modal=true], dialog[open], [popover]";
  const nameOf = (element: Element) =>
    element.closest("[data-testid]")?.getAttribute("data-testid") ?? `${element.tagName.toLowerCase()}.${element.className}`;
  const isStuck = (element: Element, style: CSSStyleDeclaration, box: DOMRect) => {
    if (style.position === "fixed") {
      return true;
    }
    const top = parseFloat(style.top);
    const bottom = parseFloat(style.bottom);
    return (
      (!Number.isNaN(top) && Math.abs(box.top - top) < 1) || (!Number.isNaN(bottom) && Math.abs(innerHeight - box.bottom - bottom) < 1)
    );
  };
  const bars: CoveringBar[] = [];
  for (const element of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") {
      continue;
    }
    const box = element.getBoundingClientRect();
    const top = Math.max(0, box.top);
    const bottom = Math.min(innerHeight, box.bottom);
    const shown = bottom > top && box.width > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0;
    if (shown && !element.closest(overlay) && isStuck(element, style, box)) {
      bars.push({ bar: nameOf(element), top, bottom });
    }
  }
  scrollTo(0, kept);
  const spans = [...bars].sort((a, b) => a.top - b.top);
  let covered = 0;
  let reached = 0;
  for (const span of spans) {
    const from = Math.max(span.top, reached);
    if (span.bottom > from) {
      covered += span.bottom - from;
      reached = span.bottom;
    }
  }
  return { share: covered / innerHeight, bars };
};

export interface TextSample {
  text: string;
  size: number;
}

declare global {
  interface Window {
    reflowTextSamples?: Element[];
  }
}

export const sampleTextSizes = (first: boolean): Array<TextSample | null> => {
  const hasOwnText = (element: Element) =>
    [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "");
  if (first) {
    window.reflowTextSamples = [...document.body.querySelectorAll("*")].filter(
      (element) => hasOwnText(element) && element.getClientRects().length > 0 && !element.closest("script, style"),
    );
  }
  return (window.reflowTextSamples ?? []).map((element) =>
    element.isConnected
      ? { text: (element.textContent ?? "").trim().slice(0, 40), size: parseFloat(getComputedStyle(element).fontSize) }
      : null,
  );
};

export const clippedScrollPositions = (control: Element): number[] => {
  const positions: number[] = [];
  for (let parent = control.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const clips = [style.overflowX, style.overflowY].some((overflow) => overflow === "hidden" || overflow === "clip");
    if (clips) {
      positions.push(parent.scrollTop, parent.scrollLeft);
    }
  }
  return positions;
};

export const scrollWindowsTooShort = (overlay: Element, smallestShare: number): string[] => {
  const scrolls = (element: Element) => {
    const style = getComputedStyle(element);
    return (style.overflowY === "auto" || style.overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1;
  };
  return [overlay, ...overlay.querySelectorAll("*")]
    .filter((element) => scrolls(element) && element.clientHeight < innerHeight * smallestShare)
    .map((element) => element.getAttribute("data-testid") ?? `${element.tagName.toLowerCase()}.${element.className}`);
};
