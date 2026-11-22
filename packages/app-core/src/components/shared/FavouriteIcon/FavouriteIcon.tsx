import { useEffect, useRef } from "react";
import styles from "./FavouriteIcon.module.scss";

export interface FavouriteIconProps {
  filled: boolean;
}

const HEART =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

// Drawn, not typed: a serif ♥ is smaller than its ♡, so favouriting seemed to shrink the heart.
export const FavouriteIcon = ({ filled }: FavouriteIconProps) => {
  const wasFilled = useRef(filled);
  const justMarked = filled && !wasFilled.current;

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
      <path className={`${styles.fill} ${filled ? styles.fillOn : ""} ${justMarked ? styles.marking : ""}`} d={HEART} fill="currentColor" />
    </svg>
  );
};
