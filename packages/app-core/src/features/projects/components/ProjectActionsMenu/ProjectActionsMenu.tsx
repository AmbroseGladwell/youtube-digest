import { useRef, useState, type Ref } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./ProjectActionsMenu.module.scss";
import { projectActionsMenuTestIds } from "./ProjectActionsMenuTestIds.js";

export interface ProjectActionsMenuProps {
  ref?: Ref<HTMLButtonElement> | undefined;
  archived: boolean;
  onRename: () => void;
  onEditPurpose: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const ProjectActionsMenu = ({ archived, onRename, onEditPurpose, onArchive, onDelete, ref: trigger }: ProjectActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  useDismissOnOutside(open, () => setOpen(false), root);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        ref={trigger}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="More for this project"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={projectActionsMenuTestIds.trigger}
      >
        <StrokeIcon name="more" size={16} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" data-testid={projectActionsMenuTestIds.menu}>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose(onRename)}
            data-testid={projectActionsMenuTestIds.renameItem}
          >
            <StrokeIcon name="pencil" size={13} />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={choose(onEditPurpose)}
            data-testid={projectActionsMenuTestIds.purposeItem}
          >
            <StrokeIcon name="pencil" size={13} />
            Edit what it’s for
          </button>
          {!archived && (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={choose(onArchive)}
              data-testid={projectActionsMenuTestIds.archiveItem}
            >
              <StrokeIcon name="archive" size={14} />
              Archive
            </button>
          )}
          <span className={styles.rule} aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={choose(onDelete)}
            data-testid={projectActionsMenuTestIds.deleteItem}
          >
            <StrokeIcon name="close" size={13} />
            Delete project…
          </button>
        </div>
      )}
    </div>
  );
};
