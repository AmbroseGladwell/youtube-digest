import styles from "./PastedLink.module.scss";
import { pastedLinkTestIds } from "./PastedLinkTestIds.js";

export const PastedLink = ({ url }: { url: string }) => {
  return (
    <div className={styles.root}>
      <p className={styles.label}>YouTube link</p>
      <p className={styles.field} data-testid={pastedLinkTestIds.root}>
        {url}
      </p>
    </div>
  );
};
