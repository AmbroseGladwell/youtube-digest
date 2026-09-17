import { useEffect, useRef } from "react";
import styles from "./FavouriteIcon.module.scss";

export interface FavouriteIconProps {
  filled: boolean;
}

const HEART =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

// One piece of geometry that either takes a fill or doesn't. The ♡/♥ characters this
// replaces are two unrelated glyphs (U+2661 and U+2665) whose serif faces draw the filled
// one visibly smaller, so favouriting appeared to shrink the heart; no font-size can
// square that, the outline and the fill have to be the same shape. The fill is a second
// path over the same `d` for the same reason — design 9d pops it on the way in, and the
// outline underneath must not move while it does.
//
// The pop confirms a mark that was just made, so it has to know one just happened: a
// library of favourited rows would otherwise pop every heart on arrival.
export function FavouriteIcon({ filled }: FavouriteIconProps) {
  const wasFilled = useRef(filled);
  const marking = filled && !wasFilled.current;

  useEffect(() => {
    wasFilled.current = filled;
  });

  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={HEART} />
      <path
        className={`${styles.fill} ${filled ? styles.fillOn : ""} ${marking ? styles.marking : ""}`}
        d={HEART}
        fill="currentColor"
      />
    </svg>
  );
}
