import type { ReactNode } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import styles from "./CookingIngredientsSheet.module.scss";
import { cookingIngredientsSheetTestIds } from "./CookingIngredientsSheetTestIds.js";

export interface CookingIngredientsSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const CookingIngredientsSheet = ({ open, onClose, children }: CookingIngredientsSheetProps) => (
  <BottomSheet open={open} title="Ingredients" head={null} onClose={onClose} wide="dialog" testId={cookingIngredientsSheetTestIds.root}>
    <div className={styles.content}>{children}</div>
  </BottomSheet>
);
