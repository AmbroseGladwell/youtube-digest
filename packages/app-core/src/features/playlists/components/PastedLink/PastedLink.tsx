import styles from "./PastedLink.module.scss";
import { pastedLinkTestIds } from "./PastedLinkTestIds.js";

// The link the reader gave, kept in view above what the app made of it (design 27b, 27g).
export function PastedLink({ url }: { url: string }) {
  return (
    <div className={styles.root}>
      <p className={styles.label}>YouTube link</p>
      <p className={styles.field} data-testid={pastedLinkTestIds.root}>
        {url}
      </p>
    </div>
  );
}
