import { useEffect, useState, type RefCallback } from "react";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";

export type ColumnScale = "full" | "narrow" | "compact";

export const NARROW_UNDER_PX = 720;
export const COMPACT_UNDER_PX = 480;

export const columnScale = (width: number): ColumnScale =>
  width < COMPACT_UNDER_PX ? "compact" : width < NARROW_UNDER_PX ? "narrow" : "full";

export interface CookingColumnScale {
  gauge: RefCallback<HTMLElement>;
  scale: ColumnScale;
  onDrawerSettled: () => void;
}

// The action's size steps down with the width of the column it sits in, measured off a gauge
// laid out at the column's settled width (design 190g). Opening the drawer takes the smaller
// size at the start; closing it takes the larger one only once the drawer has gone (190i), so
// text never grows into a column that is still shrinking.
export function useCookingColumnScale(drawerOpen: boolean): CookingColumnScale {
  const [gauge, setGauge] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [lastOpen, setLastOpen] = useState(drawerOpen);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState<ColumnScale>("full");

  useEffect(() => {
    if (gauge === null) return;
    const publish = () => setWidth(gauge.getBoundingClientRect().width);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(gauge);
    return () => observer.disconnect();
  }, [gauge]);

  if (lastOpen !== drawerOpen) {
    setLastOpen(drawerOpen);
    setHolding(!drawerOpen && !prefersReducedMotion());
  }

  const measured = width === null ? "full" : columnScale(width);
  if (!holding && held !== measured) setHeld(measured);

  return {
    gauge: setGauge,
    scale: holding ? held : measured,
    onDrawerSettled: () => setHolding(false),
  };
}
