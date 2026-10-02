import { useRef, useState } from "react";
import type { OverviewMenuItem } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useReaderAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import type { OverviewInWebApp } from "../../../sync/useOverviewInWebApp.js";
import styles from "./OverviewActionsMenu.module.scss";
import { overviewActionsMenuTestIds } from "./OverviewActionsMenuTestIds.js";

export interface OverviewActionsMenuProps {
  topicCount: number;
  hasReason: boolean;
  read: boolean;
  videoUrl: string;
  // Absent where there is no account to share under, which is how the item hides itself
  // rather than offering a control that cannot work (docs/features/sharing.md).
  onShare: (() => void) | null;
  // Design 6h: the panel's menu offers the web app instead of read state and deletion.
  compact: boolean;
  webApp: OverviewInWebApp;
  onEditTopics: () => void;
  onEditReason: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

// Design 4b/6h: everything about the note that is not reading it.
export function OverviewActionsMenu({
  topicCount,
  hasReason,
  read,
  videoUrl,
  compact,
  webApp,
  onShare,
  onEditTopics,
  onEditReason,
  onToggleRead,
  onDelete,
}: OverviewActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const analytics = useReaderAnalytics();

  const close = () => {
    analytics.actionsMenu.closed();
    setOpen(false);
  };

  useDismissOnOutside(open, close, root);

  const choose = (item: OverviewMenuItem, action: () => void) => () => {
    analytics.actionsMenu.itemChosen({ item });
    setOpen(false);
    action();
  };

  return (
    <div className={styles.root} ref={root} data-testid={overviewActionsMenuTestIds.root}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          analytics.actionsMenu.opened();
          setOpen(true);
        }}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={overviewActionsMenuTestIds.trigger}
      >
        <StrokeIcon name="more" size={16} />
      </button>

      {open && (
        <div
          className={styles.menu}
          role="menu"
          data-testid={overviewActionsMenuTestIds.menu}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose("editTopics", onEditTopics)}
            data-testid={overviewActionsMenuTestIds.editTopicsItem}
          >
            Edit topics
            <span className={styles.count} data-testid={overviewActionsMenuTestIds.topicCount}>
              {topicCount}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose("editReason", onEditReason)}
            data-testid={overviewActionsMenuTestIds.reasonItem}
          >
            {hasReason ? "Edit reason" : "Add reason"}
          </button>
          {!compact && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose("toggleRead", onToggleRead)}
              data-testid={overviewActionsMenuTestIds.readItem}
            >
              {read ? "Mark as unread" : "Mark as read"}
            </button>
          )}
          {onShare !== null && (
            <>
              <span className={styles.rule} aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${styles.itemStandout}`}
                onClick={choose("share", onShare)}
                data-testid={overviewActionsMenuTestIds.shareItem}
              >
                Share…
                <StrokeIcon name="share" size={16} />
              </button>
            </>
          )}
          <a
            role="menuitem"
            className={styles.item}
            href={videoUrl}
            target="_blank"
            rel="noopener"
            onClick={choose("watchOnYouTube", () => undefined)}
            data-testid={overviewActionsMenuTestIds.watchItem}
          >
            Watch on YouTube
          </a>
          {canWriteClipboard() && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose("copyYouTubeLink", () => void navigator.clipboard.writeText(videoUrl))}
              data-testid={overviewActionsMenuTestIds.copyLinkItem}
            >
              Copy YouTube link
            </button>
          )}
          {compact ? (
            webApp !== null &&
            ("href" in webApp ? (
              <a
                role="menuitem"
                className={styles.item}
                href={webApp.href}
                target="_blank"
                rel="noopener"
                onClick={choose("openInWebApp", () => undefined)}
                data-testid={overviewActionsMenuTestIds.openInWebItem}
              >
                Open in web app
              </a>
            ) : (
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${styles.itemWithReason}`}
                disabled
                data-testid={overviewActionsMenuTestIds.openInWebItem}
              >
                Open in web app
                <span className={styles.reason} data-testid={overviewActionsMenuTestIds.openInWebReason}>
                  {webApp.reason}
                </span>
              </button>
            ))
          ) : (
            <button
              type="button"
              role="menuitem"
              className={`${styles.item} ${styles.itemDanger}`}
              onClick={choose("delete", onDelete)}
              data-testid={overviewActionsMenuTestIds.deleteItem}
            >
              Delete overview
            </button>
          )}
        </div>
      )}
    </div>
  );
}
