import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { fittingChipCount } from "../../util/fittingChipCount.js";

const GAP = 6;
const LEAST_TITLE_SHOWN = 64;

interface Measured {
  key: string;
  leastChipWidths: number[];
  moreWidth: number;
}

interface Room {
  box: HTMLElement | null;
  width: () => number;
}

export interface ChipFit {
  rowRef: RefObject<HTMLDivElement | null>;
  moreRef: RefObject<HTMLSpanElement | null>;
  measuring: boolean;
  shown: number;
}

const pixels = (value: string) => Number.parseFloat(value) || 0;

const leastWidth = (slot: HTMLElement) => {
  const cuttable = slot.querySelector<HTMLElement>("[data-cuttable]")?.offsetWidth ?? 0;
  return slot.offsetWidth - Math.max(0, cuttable - LEAST_TITLE_SHOWN);
};

const roomFor = (row: HTMLElement): Room => {
  const rowStyle = getComputedStyle(row);
  let lost = pixels(rowStyle.paddingLeft) + pixels(rowStyle.paddingRight);
  let box = row.parentElement;
  while (box !== null && getComputedStyle(box).display.startsWith("inline")) {
    const style = getComputedStyle(box);
    lost += pixels(style.marginLeft) + pixels(style.marginRight);
    box = box.parentElement;
  }
  const container = box;
  return {
    box: container,
    width: () => {
      if (container === null) {
        return Number.POSITIVE_INFINITY;
      }
      const style = getComputedStyle(container);
      return container.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight) - lost;
    },
  };
};

export const useChipFit = (chipKeys: readonly string[], most: number): ChipFit => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLSpanElement | null>(null);
  const measured = useRef<Measured | null>(null);
  const key = chipKeys.join("\n");
  const [fit, setFit] = useState<{ key: string; shown: number } | null>(null);
  const measuring = fit?.key !== key;

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (row === null || !measuring) {
      return;
    }
    measured.current = {
      key,
      leastChipWidths: [...row.querySelectorAll<HTMLElement>(":scope > [data-chip-slot]")].map(leastWidth),
      moreWidth: moreRef.current?.offsetWidth ?? 0,
    };
  });

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (row === null) {
      return;
    }
    const room = roomFor(row);
    const refit = () => {
      const sizes = measured.current;
      if (sizes?.key !== key) {
        return;
      }
      const fitting = fittingChipCount(sizes.leastChipWidths, room.width(), sizes.moreWidth, GAP);
      setFit({ key, shown: Math.max(1, Math.min(most, fitting, sizes.leastChipWidths.length)) });
    };
    refit();
    if (room.box === null) {
      return;
    }
    const observer = new ResizeObserver(refit);
    observer.observe(room.box);
    return () => observer.disconnect();
  }, [key, most]);

  return { rowRef, moreRef, measuring, shown: measuring ? chipKeys.length : fit.shown };
};
