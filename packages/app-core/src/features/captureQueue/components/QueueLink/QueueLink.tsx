import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useKeptLinksController } from "../../../captures/KeptLinksContext.js";
import { useCaptureQueueController } from "../../CaptureQueueContext.js";
import styles from "./QueueLink.module.scss";
import { queueLinkTestIds } from "./QueueLinkTestIds.js";

// Designs 358h-6, 358h-10: a quiet way in at the top of the sidebar, shown only while something waits.
export const QueueLink = () => {
  const queue = useCaptureQueueController();
  const kept = useKeptLinksController();
  const keptWaiting = kept?.links.filter((link) => link.queueStatus === "waiting").length ?? 0;
  const keptFailed = kept?.links.filter((link) => link.queueStatus === "failed").length ?? 0;
  const making = (queue.making === null ? 0 : 1) + (kept?.making == null ? 0 : 1);
  const count = queue.waiting.length + keptWaiting + making;
  const attention = queue.attention.length + keptFailed;
  if (!queue.available || count + attention === 0) {
    return null;
  }
  return (
    <PageLink className={styles.root} to={Routes.queue()} data-testid={queueLinkTestIds.root}>
      <span className={styles.name}>
        <StrokeIcon name="clock" size={14} />
        Queue
      </span>
      <small className={attention > 0 ? styles.attention : styles.count} data-testid={queueLinkTestIds.count}>
        {attention > 0 ? `${attention.toLocaleString("en-GB")} needs attention · ` : ""}
        {count.toLocaleString("en-GB")}
      </small>
    </PageLink>
  );
};
