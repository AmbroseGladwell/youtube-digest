import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { libraryRowHeights } from "../../util/libraryRowHeights.js";
import { libraryScrollPositions } from "../../util/libraryScrollPositions.js";
import styles from "./LibraryList.module.scss";

const ESTIMATED_ROW_PX = 190;
const OVERSCAN_ROWS = 6;

export interface LibraryListProps<Entry> {
  entries: readonly Entry[];
  keyOf: (entry: Entry) => string;
  row: (entry: Entry, index: number) => ReactNode;
  testId: string;
}

// Why only the rows near the screen are in the page: docs/features/library-view.md, "At scale".
export const LibraryList = <Entry,>({ entries, keyOf, row, testId }: LibraryListProps<Entry>) => {
  const list = useRef<HTMLDivElement | null>(null);
  const { key: historyKey } = useLocation();
  const [placed, setPlaced] = useState({ top: 0, width: 0 });
  const heights = libraryRowHeights(placed.width);

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: entries.length,
    estimateSize: (index) => heights.get(keyOf(entries[index]!)) ?? ESTIMATED_ROW_PX,
    getItemKey: (index) => keyOf(entries[index]!),
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
          {row(entries[item.index]!, item.index)}
        </div>
      ))}
    </div>
  );
};
