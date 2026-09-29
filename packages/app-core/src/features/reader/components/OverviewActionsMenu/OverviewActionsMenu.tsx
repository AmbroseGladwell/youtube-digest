import { useRef, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./OverviewActionsMenu.module.scss";
import { overviewActionsMenuTestIds } from "./OverviewActionsMenuTestIds.js";

export interface OverviewActionsMenuProps {
  topicCount: number;
  hasReason: boolean;
  read: boolean;
  videoUrl: string;
  // Design 6h: the panel's menu offers the web app instead of read state and deletion.
  compact: boolean;
  // Which edge of the trigger the menu hangs from, so it opens into the space there is.
  align: "start" | "end";
  onEditTopics: () => void;
  onEditReason: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

// Design 4b/6h: everything about the note that is not reading it. Open in web app is
// placed but not wired (docs/features/stone-theme.md, "Placed but not wired").
export function OverviewActionsMenu({
  topicCount,
  hasReason,
  read,
  videoUrl,
  compact,
  align,
  onEditTopics,
  onEditReason,
  onToggleRead,
  onDelete,
}: OverviewActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useDismissOnOutside(open, () => setOpen(false), root);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className={styles.root} ref={root} data-testid={overviewActionsMenuTestIds.root}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={overviewActionsMenuTestIds.trigger}
      >
        <StrokeIcon name="more" size={16} />
      </button>

      {open && (
        <div
          className={`${styles.menu} ${align === "start" ? styles.menuStart : styles.menuEnd}`}
          role="menu"
          data-testid={overviewActionsMenuTestIds.menu}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose(onEditTopics)}
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
            onClick={choose(onEditReason)}
            data-testid={overviewActionsMenuTestIds.reasonItem}
          >
            {hasReason ? "Edit reason" : "Add reason"}
          </button>
          {!compact && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose(onToggleRead)}
              data-testid={overviewActionsMenuTestIds.readItem}
            >
              {read ? "Mark as unread" : "Mark as read"}
            </button>
          )}
          <a
            role="menuitem"
            className={styles.item}
            href={videoUrl}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
            data-testid={overviewActionsMenuTestIds.watchItem}
          >
            Watch on YouTube
          </a>
          {canWriteClipboard() && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose(() => void navigator.clipboard.writeText(videoUrl))}
              data-testid={overviewActionsMenuTestIds.copyLinkItem}
            >
              Copy link
            </button>
          )}
          {compact ? (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              disabled
              title="The web app has no address for this note yet"
              data-testid={overviewActionsMenuTestIds.openInWebItem}
            >
              Open in web app
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={`${styles.item} ${styles.itemDanger}`}
              onClick={choose(onDelete)}
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
