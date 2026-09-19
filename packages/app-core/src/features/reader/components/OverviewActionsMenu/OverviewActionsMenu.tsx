import { useRef, useState } from "react";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./OverviewActionsMenu.module.scss";
import { overviewActionsMenuTestIds } from "./OverviewActionsMenuTestIds.js";

export interface OverviewActionsMenuProps {
  topicCount: number;
  onEditTopics: () => void;
}

export function OverviewActionsMenu({ topicCount, onEditTopics }: OverviewActionsMenuProps) {
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
        <div className={styles.menu} role="menu" data-testid={overviewActionsMenuTestIds.menu}>
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
        </div>
      )}
    </div>
  );
}
