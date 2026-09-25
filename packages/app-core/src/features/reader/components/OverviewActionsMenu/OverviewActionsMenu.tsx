import { useRef, useState } from "react";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./OverviewActionsMenu.module.scss";
import { overviewActionsMenuTestIds } from "./OverviewActionsMenuTestIds.js";

export interface OverviewActionsMenuProps {
  topicCount: number;
  hasReason: boolean;
  // Which edge of the trigger the menu hangs from, so it opens into the space there is.
  align: "start" | "end";
  onEditTopics: () => void;
  onEditReason: () => void;
}

export function OverviewActionsMenu({
  topicCount,
  hasReason,
  align,
  onEditTopics,
  onEditReason,
}: OverviewActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useDismissOnOutside(open, () => setOpen(false), root);

  return (
    <div className={styles.root} ref={root} data-testid={overviewActionsMenuTestIds.root}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={overviewActionsMenuTestIds.trigger}
      >
        ⋯
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
            onClick={() => {
              setOpen(false);
              onEditTopics();
            }}
            data-testid={overviewActionsMenuTestIds.editTopicsItem}
          >
            Edit topics
            <span className={styles.count} data-testid={overviewActionsMenuTestIds.topicCount}>
              {topicCount}
            </span>
          </button>
          {/* Design 21c: under Edit topics, because both are "about this overview" edits. */}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false);
              onEditReason();
            }}
            data-testid={overviewActionsMenuTestIds.reasonItem}
          >
            {hasReason ? "Edit reason" : "Add reason"}
          </button>
        </div>
      )}
    </div>
  );
}
