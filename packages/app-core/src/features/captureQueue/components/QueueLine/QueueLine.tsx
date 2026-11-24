import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useQueueCount } from "../../useQueueCount.js";
import styles from "./QueueLine.module.scss";
import { queueLineTestIds } from "./QueueLineTestIds.js";

// Design 399m-7: where there's no sidebar, a line under the search row while anything is queued.
export const QueueLine = () => {
  const count = useQueueCount();
  const analytics = useAnalytics();
  if (count === null) {
    return null;
  }
  return (
    <p className={styles.root} data-testid={queueLineTestIds.root}>
      <i className={styles.dot} aria-hidden="true" />
      <b className={styles.count}>{count.queued.toLocaleString("en-GB")} in the queue</b>
      {count.attention > 0 && <span className={styles.attention}>· {count.attention.toLocaleString("en-GB")} needs you</span>}
      <PageLink
        className={styles.link}
        to={Routes.queue()}
        onClick={() => analytics.app.nav.pageChosen({ page: "queue", from: "queueLine" })}
        data-testid={queueLineTestIds.link}
      >
        See queue
      </PageLink>
    </p>
  );
};
