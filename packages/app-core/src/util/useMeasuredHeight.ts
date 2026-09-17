import { useEffect, useState, type RefCallback } from "react";

export interface MeasuredHeightRefs<THost extends HTMLElement, TMeasured extends HTMLElement> {
  host: RefCallback<THost>;
  measured: RefCallback<TMeasured>;
}

// Anything that comes to rest against sticky chrome has to know how tall that chrome is,
// and none of it is a constant: the masthead wraps on a phone and grows with the status
// strip, and the reader's tab strip is a line of type. So the height is measured off the
// laid-out element and published as a custom property on an ancestor, rather than
// hardcoded per breakpoint (docs/features/overview-redesign.md, "Chrome that stays put").
//
// Callback refs rather than useRef, because the elements arrive later than the first
// render on any page that renders a skeleton first — the reader does.
export function useMeasuredHeight<
  THost extends HTMLElement = HTMLDivElement,
  TMeasured extends HTMLElement = HTMLElement,
>(property: string): MeasuredHeightRefs<THost, TMeasured> {
  const [host, setHost] = useState<THost | null>(null);
  const [measured, setMeasured] = useState<TMeasured | null>(null);

  useEffect(() => {
    if (!host || !measured) {
      return;
    }

    const publish = () => host.style.setProperty(property, `${measured.offsetHeight}px`);

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(measured);
    return () => observer.disconnect();
  }, [host, measured, property]);

  return { host: setHost, measured: setMeasured };
}
