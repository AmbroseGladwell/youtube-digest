import { useEffect, useRef, type ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./CookingIngredientsSheet.module.scss";
import { cookingIngredientsSheetTestIds } from "./CookingIngredientsSheetTestIds.js";

export interface CookingIngredientsSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Designs 150ah, 150ai: on a phone and in the panel, the note's own list as a sheet over the
// step, as written or as the reader adjusted it. Opening it pauses nothing; servings and units
// belong to the note, before cooking. The wide web gets CookingIngredientsDrawer instead.
export function CookingIngredientsSheet({ open, onClose, children }: CookingIngredientsSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label="Ingredients"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "i" || event.key === "I" || event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      data-testid={cookingIngredientsSheetTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose} data-testid={cookingIngredientsSheetTestIds.close}>
            <StrokeIcon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
