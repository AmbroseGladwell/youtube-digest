import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatTimeSaved } from "@overview/domain";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";
import { odometerColumns } from "../../util/odometerColumns.js";
import styles from "./TimeSavedFigure.module.scss";

export interface TimeSavedFigureProps {
  minutes: number;
  // Where the first roll starts from, for a figure that arrives counting up to its value.
  rollFrom?: number;
  rollDelayMs?: number;
}

const SETTLE_MS = 1150;

interface Roll {
  from: number;
  to: number;
}

// The total as a mechanical counter: a change rolls minutes first, carrying into tens and
// hours. Decorative; whatever holds it carries the figure as its accessible name.
export function TimeSavedFigure({ minutes, rollFrom, rollDelayMs = 0 }: TimeSavedFigureProps) {
  const settled = useRef(rollFrom ?? minutes);
  const [shown, setShown] = useState(settled.current);
  const [roll, setRoll] = useState<Roll | null>(null);

  useEffect(() => {
    const from = settled.current;
    settled.current = minutes;
    if (from === minutes) {
      return;
    }
    if (prefersReducedMotion()) {
      setShown(minutes);
      setRoll(null);
      return;
    }
    const start = setTimeout(() => setRoll({ from, to: minutes }), rollDelayMs);
    const settle = setTimeout(() => {
      setShown(minutes);
      setRoll(null);
    }, rollDelayMs + SETTLE_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(settle);
      setShown(minutes);
      setRoll(null);
    };
  }, [minutes, rollDelayMs]);

  if (roll === null) {
    return (
      <span className={styles.root} aria-hidden="true">
        {formatTimeSaved(shown)}
      </span>
    );
  }

  return (
    <span className={styles.root} aria-hidden="true">
      {odometerColumns(roll.from, roll.to).map((column) => (
        <span key={column.key}>
          <span className={styles.window}>
            <span
              className={`${styles.strip} ${column.up ? styles.rollUp : styles.rollDown}`}
              style={
                {
                  "--odometer-steps": column.rows.length - 1,
                  animationDelay: `${column.delayMs}ms`,
                  animationDuration: `${column.durationMs}ms`,
                } as CSSProperties
              }
            >
              {column.rows.map((row, index) => (
                <span key={index} className={styles.row}>
                  {row}
                </span>
              ))}
            </span>
          </span>
          {column.suffix}
        </span>
      ))}
    </span>
  );
}
