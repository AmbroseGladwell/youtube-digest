import { useRef, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./TopicActionsMenu.module.scss";
import { topicActionsMenuTestIds } from "./TopicActionsMenuTestIds.js";

export type TopicAction = "rename" | "merge" | "delete";

export interface TopicActionsMenuProps {
  name: string;
  canMerge: boolean;
  onChoose: (action: TopicAction) => void;
}

// Design 10h-2: a topic's own page opens one step of Manage topics.
export const TopicActionsMenu = ({ name, canMerge, onChoose }: TopicActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  useDismissOnOutside(open, () => setOpen(false), root);

  const choose = (action: TopicAction) => () => {
    setOpen(false);
    onChoose(action);
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen(!open)}
        aria-label={`More for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={topicActionsMenuTestIds.trigger}
      >
        <StrokeIcon name="more" size={18} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" data-testid={topicActionsMenuTestIds.menu}>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose("rename")}
            data-testid={topicActionsMenuTestIds.renameItem}
          >
            <StrokeIcon name="pen" size={14} />
            Rename or edit description
          </button>
          {canMerge && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose("merge")}
              data-testid={topicActionsMenuTestIds.mergeItem}
            >
              <StrokeIcon name="merge" size={14} />
              Merge into another topic…
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={choose("delete")}
            data-testid={topicActionsMenuTestIds.deleteItem}
          >
            <StrokeIcon name="trash" size={14} />
            Delete topic
          </button>
        </div>
      )}
    </div>
  );
};
