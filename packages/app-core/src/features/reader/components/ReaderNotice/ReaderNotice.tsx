import type { ReactNode } from "react";
import styles from "./ReaderNotice.module.scss";
import { readerNoticeTestIds } from "./ReaderNoticeTestIds.js";

export const ReaderNotice = ({ children }: { children: ReactNode }) => {
  return (
    <p className={styles.root} data-testid={readerNoticeTestIds.root}>
      {children}
    </p>
  );
};
