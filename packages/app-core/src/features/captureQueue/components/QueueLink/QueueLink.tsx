import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useQueueCount } from "../../useQueueCount.js";
import styles from "./QueueLink.module.scss";
import { queueLinkTestIds } from "./QueueLinkTestIds.js";

// Design 358h-6: a quiet way in under the first-run hero, shown only while something waits.
export const QueueLink = () => {
  const count = useQueueCount();
  if (count === null) {
    return null;
  }
  return (
    <PageLink className={styles.root} to={Routes.queue()} data-testid={queueLinkTestIds.root}>
      <span className={styles.name}>
        <StrokeIcon name="clock" size={14} />
        Queue
      </span>
      <small className={count.attention > 0 ? styles.attention : styles.count} data-testid={queueLinkTestIds.count}>
        {count.attention > 0 ? `${count.attention.toLocaleString("en-GB")} needs attention · ` : ""}
        {count.queued.toLocaleString("en-GB")}
      </small>
    </PageLink>
  );
};
