import type { ArticleFailureCopy } from "../../../newOverview/util/articleFailureCopy.js";
import styles from "./ArticleFailureNotice.module.scss";
import { articleFailureNoticeTestIds } from "./ArticleFailureNoticeTestIds.js";

export interface ArticleFailureNoticeProps {
  copy: ArticleFailureCopy;
  onWay: () => void;
}

// Designs 77ai–77al: the error pattern, with one way forward where there is one. Trying again
// has to be a press, because asking Chrome again needs one.
export function ArticleFailureNotice({ copy, onWay }: ArticleFailureNoticeProps) {
  return (
    <div className={styles.root} role="alert" data-testid={articleFailureNoticeTestIds.root}>
      <h2 className={styles.title} data-testid={articleFailureNoticeTestIds.title}>
        {copy.title}
      </h2>
      <p className={styles.body} data-testid={articleFailureNoticeTestIds.body}>
        {copy.body}
      </p>
      {copy.wayLabel !== null && (
        <button
          type="button"
          className={copy.way === "tryAgain" ? styles.quietWay : styles.way}
          onClick={onWay}
          data-testid={articleFailureNoticeTestIds.way}
        >
          {copy.wayLabel}
        </button>
      )}
    </div>
  );
}
