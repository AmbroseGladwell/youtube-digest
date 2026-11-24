import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { libraryRowHeights } from "../../util/libraryRowHeights.js";
import { libraryScrollPositions } from "../../util/libraryScrollPositions.js";
import styles from "./LibraryList.module.scss";
import { libraryListTestIds } from "./LibraryListTestIds.js";

const ESTIMATED_ROW_PX = 190;
const BANNER_QUERY = "(max-width: 29.9375rem)";
const BANNER_ROW_TEXT_PX = 250;

const OVERSCAN_ROWS = 6;

const estimatedRowPx = (listWidth: number): number =>
  globalThis.matchMedia?.(BANNER_QUERY).matches ? Math.round(listWidth / 2) + BANNER_ROW_TEXT_PX : ESTIMATED_ROW_PX;

export interface LibraryListProps<Entry> {
  entries: readonly Entry[];
  keyOf: (entry: Entry) => string;
  row: (entry: Entry, index: number) => ReactNode;
  headingAt?: (index: number) => LibraryListHeading | null;
  testId: string;
}

export interface LibraryListHeading {
  text: string;
  count: number;
}

// Only rows near the screen, a heading in its group's first item: docs/features/library-view.md, "At scale"; library-sort.md, "Group by".
export const LibraryList = <Entry,>({ entries, keyOf, row, headingAt, testId }: LibraryListProps<Entry>) => {
  const list = useRef<HTMLDivElement | null>(null);
  const { key: historyKey } = useLocation();
  const [placed, setPlaced] = useState({ top: 0, width: 0 });
  const heights = libraryRowHeights(placed.width);
  const rowEstimate = estimatedRowPx(placed.width);
  const keyAt = (index: number) => {
    const heading = headingAt?.(index) ?? null;
    return heading === null ? keyOf(entries[index]!) : `${keyOf(entries[index]!)}@${heading.text}`;
  };

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: entries.length,
    estimateSize: (index) => heights.get(keyAt(index)) ?? rowEstimate,
    getItemKey: keyAt,
    overscan: OVERSCAN_ROWS,
    scrollMargin: placed.top,
    initialOffset: () => libraryScrollPositions.get(historyKey) ?? 0,
    initialRect: { width: window.innerWidth, height: window.innerHeight },
    measureElement: (element, entry) => {
      const height = Math.round(entry?.borderBoxSize[0]?.blockSize ?? element.getBoundingClientRect().height);
      const key = element.getAttribute("data-key");
      if (key !== null) {
        heights.set(key, height);
      }
      return height;
    },
  });

  useLayoutEffect(() => {
    const element = list.current;
    if (element === null) {
      return;
    }
    const box = element.getBoundingClientRect();
    const top = Math.round(box.top + window.scrollY);
    const width = Math.round(box.width);
    if (top !== placed.top || width !== placed.width) {
      setPlaced({ top, width });
    }
  });

  useLayoutEffect(() => () => void libraryScrollPositions.set(historyKey, window.scrollY), [historyKey]);

  const shown = virtualizer.getVirtualItems();
  const first = shown[0];
  const last = shown.at(-1);
  const before = first === undefined ? 0 : first.start - placed.top;
  const after = virtualizer.getTotalSize() - (last === undefined ? 0 : last.end - placed.top);

  return (
    <div ref={list} role="list" className={styles.root} style={{ paddingTop: before, paddingBottom: after }} data-testid={testId}>
      {shown.map((item) => (
        <div
          key={item.key}
          ref={virtualizer.measureElement}
          className={styles.row}
          role="listitem"
          aria-setsize={entries.length}
          aria-posinset={item.index + 1}
          data-index={item.index}
          data-key={item.key}
        >
          {headingBefore(headingAt?.(item.index) ?? null)}
          {row(entries[item.index]!, item.index)}
        </div>
      ))}
    </div>
  );
};

const headingBefore = (heading: LibraryListHeading | null): ReactNode =>
  heading === null ? null : (
    <div className={styles.heading} data-testid={libraryListTestIds.heading}>
      <h2 className={styles.headingText}>{heading.text}</h2>
      <small className={styles.headingCount}>{heading.count}</small>
    </div>
  );
