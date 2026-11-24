import { useEffect, useRef } from "react";
import styles from "./ReadIcon.module.scss";

export interface ReadIconProps {
  read: boolean;
}

// Design 407p–q: the heart's partner, so read fills the way favourite does.
export const ReadIcon = ({ read }: ReadIconProps) => {
  const wasRead = useRef(read);
  const justMarked = read && !wasRead.current;

  useEffect(() => {
    wasRead.current = read;
  });

  return (
    <svg
      className={`${styles.icon} ${read ? styles.read : ""} ${justMarked ? styles.marking : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle className={styles.disc} cx="12" cy="12" r="10" />
      <path className={styles.tick} pathLength={1} d="m9 12 2 2 4-4" />
    </svg>
  );
};
