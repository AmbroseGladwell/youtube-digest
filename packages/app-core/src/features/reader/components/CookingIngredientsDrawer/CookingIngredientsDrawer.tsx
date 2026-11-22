import { useEffect, useRef, type ReactNode, type TransitionEvent } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./CookingIngredientsDrawer.module.scss";
import { cookingIngredientsDrawerTestIds } from "./CookingIngredientsDrawerTestIds.js";

export interface CookingIngredientsDrawerProps {
  id: string;
  open: boolean;
  asked: boolean;
  onClose: () => void;
  onSettled: () => void;
  children: ReactNode;
}

// Not modal, so no key is trapped: docs/features/recipe-notes.md, "Cooking step by step".
export const CookingIngredientsDrawer = ({ id, open, asked, onClose, onSettled, children }: CookingIngredientsDrawerProps) => {
  const aside = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open && asked) {
      aside.current?.focus({ preventScroll: true });
    }
  }, [open, asked]);

  const onTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && event.propertyName === "width") {
      onSettled();
    }
  };

  return (
    <aside
      ref={aside}
      id={id}
      tabIndex={-1}
      className={`${styles.drawer} ${open ? styles.open : ""} ${asked ? "" : styles.inPlace}`}
      aria-label="Ingredients"
      inert={!open}
      onTransitionEnd={onTransitionEnd}
      data-testid={cookingIngredientsDrawerTestIds.root}
    >
      <div className={styles.body}>
        <div className={styles.head}>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
            data-testid={cookingIngredientsDrawerTestIds.close}
          >
            <StrokeIcon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </aside>
  );
};
