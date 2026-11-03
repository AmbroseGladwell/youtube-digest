import type { ReactNode } from "react";

export interface RecipeLineChoiceProps {
  active: boolean;
  onChoose: () => void;
  children: ReactNode;
}

// The keyboard's way to a recipe line's tap, as the note's lines have (ReadAlongNote): the
// row takes the pointer, and this takes focus, Enter and Space.
export function RecipeLineChoice({ active, onChoose, children }: RecipeLineChoiceProps) {
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
}
