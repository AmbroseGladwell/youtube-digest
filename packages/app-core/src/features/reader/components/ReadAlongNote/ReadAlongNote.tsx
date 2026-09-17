import { useEffect, useRef } from "react";
import type { NoteLine } from "../../types/NoteLine.js";
import styles from "./ReadAlongNote.module.scss";
import { readAlongNoteTestIds } from "./ReadAlongNoteTestIds.js";

export interface ReadAlongNoteProps {
  lines: NoteLine[];
  activeIndex: number;
  onSelectLine: (index: number) => void;
}

export function ReadAlongNote({ lines, activeIndex, onSelectLine }: ReadAlongNoteProps) {
  const activeLine = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeLine.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className={styles.root} data-testid={readAlongNoteTestIds.root}>
      {lines.map((line, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={`${line.section}-${index}`}
            type="button"
            ref={active ? activeLine : null}
            className={`${styles.line} ${line.heading ? styles.headingLine : styles.bodyLine} ${
              active ? styles.lineActive : ""
            }`}
            aria-current={active}
            onClick={() => onSelectLine(index)}
            data-testid={active ? readAlongNoteTestIds.activeLine : readAlongNoteTestIds.line}
          >
            {line.text}
          </button>
        );
      })}
    </div>
  );
}
