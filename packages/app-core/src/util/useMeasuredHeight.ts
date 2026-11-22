import { useEffect, useState, type RefCallback } from "react";

export interface MeasuredHeightRefs<THost extends HTMLElement, TMeasured extends HTMLElement> {
  host: RefCallback<THost>;
  measured: RefCallback<TMeasured>;
}

// Why measured, not a constant: docs/features/overview-redesign.md, "Chrome that stays put".
export const useMeasuredHeight = <THost extends HTMLElement = HTMLDivElement, TMeasured extends HTMLElement = HTMLElement>(
  property: string,
): MeasuredHeightRefs<THost, TMeasured> => {
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
};
