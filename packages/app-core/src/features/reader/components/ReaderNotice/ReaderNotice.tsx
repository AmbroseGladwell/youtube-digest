import type { ReactNode } from "react";
import styles from "./ReaderNotice.module.scss";
import { readerNoticeTestIds } from "./ReaderNoticeTestIds.js";

// Designs 77ah and 77as: one stone line about how this note came to be on screen.
export function ReaderNotice({ children }: { children: ReactNode }) {
  return (
    <p className={styles.root} data-testid={readerNoticeTestIds.root}>
      {children}
    </p>
  );
}
