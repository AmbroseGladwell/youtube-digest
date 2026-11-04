import { useEffect, useRef, type ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./CookingIngredientsSheet.module.scss";
import { cookingIngredientsSheetTestIds } from "./CookingIngredientsSheetTestIds.js";

export interface CookingIngredientsSheetProps {
  open: boolean;
  // On the wide web a drawer on the right, so the step stays readable beside it (150aj).
  drawer: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Designs 150ah–150aj: the note's own list over the step, as written or as the reader adjusted
// it. Opening it pauses nothing; servings and units belong to the note, before cooking.
export function CookingIngredientsSheet({ open, drawer, onClose, children }: CookingIngredientsSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) {
      if (drawer) element.show();
      else element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open, drawer]);

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${drawer ? styles.drawer : ""}`}
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
