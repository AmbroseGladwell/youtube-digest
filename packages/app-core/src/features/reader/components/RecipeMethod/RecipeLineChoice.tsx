import type { ReactNode } from "react";

export interface RecipeLineChoiceProps {
  active: boolean;
  onChoose: () => void;
  children: ReactNode;
}

// The row takes the pointer; this takes focus, Enter and Space, as ReadAlongNote's lines do.
export const RecipeLineChoice = ({ active, onChoose, children }: RecipeLineChoiceProps) => {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-current={active}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onChoose();
        }
      }}
    >
      {children}
    </span>
  );
};
