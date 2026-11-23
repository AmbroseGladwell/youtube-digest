import type { ArticleFailureCopy } from "../../../newOverview/util/articleFailureCopy.js";
import styles from "./ArticleFailureNotice.module.scss";
import { articleFailureNoticeTestIds } from "./ArticleFailureNoticeTestIds.js";

export interface ArticleFailureNoticeProps {
  copy: ArticleFailureCopy;
  onWay: () => void;
  href?: string | null;
  after?: string | null;
  // Designs 130l to 130n: Try another link as the main way on, where it is the only one.
  prominent?: boolean;
}

// Trying again has to be a press, because asking Chrome again needs one.
export const ArticleFailureNotice = ({ copy, onWay, href = null, after = null, prominent = false }: ArticleFailureNoticeProps) => {
  const quiet = !prominent && (copy.way === "tryAgain" || copy.way === "tryAnother");
  return (
    <div className={styles.root} role="alert" data-testid={articleFailureNoticeTestIds.root}>
      <h2 className={styles.title} data-testid={articleFailureNoticeTestIds.title}>
        {copy.title}
      </h2>
      <p className={styles.body} data-testid={articleFailureNoticeTestIds.body}>
        {copy.body}
      </p>
      {copy.wayLabel !== null &&
        (href === null ? (
          <button
            type="button"
            className={quiet ? styles.quietWay : styles.way}
            onClick={onWay}
            data-testid={articleFailureNoticeTestIds.way}
          >
            {copy.wayLabel}
          </button>
        ) : (
          <a className={styles.way} href={href} target="_blank" rel="noopener" data-testid={articleFailureNoticeTestIds.way}>
            {copy.wayLabel}
          </a>
        ))}
      {after !== null && <p className={styles.after}>{after}</p>}
    </div>
  );
};
