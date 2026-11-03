import { useEffect } from "react";
import { createPortal } from "react-dom";
import { recipeFigures, recipeFiguresLine, recipeStepGroups, type RecipeNote, type WebSource } from "@overview/domain";
import styles from "./RecipePrintSheet.module.scss";
import { recipePrintSheetTestIds } from "./RecipePrintSheetTestIds.js";

export interface RecipePrintSheetProps {
  source: WebSource;
  from: string;
  recipe: RecipeNote;
  ingredients: readonly string[];
  adjusted: string | null;
  onDone: () => void;
}

// Design 144s: the page's recipe on one sheet, black on white whatever the theme, and
// nothing of ours. It exists only while the print dialog is open.
export function RecipePrintSheet({ source, from, recipe, ingredients, adjusted, onDone }: RecipePrintSheetProps) {
  useEffect(() => {
    window.addEventListener("afterprint", onDone);
    const printing = window.setTimeout(() => window.print(), 0);
    return () => {
      window.clearTimeout(printing);
      window.removeEventListener("afterprint", onDone);
    };
  }, [onDone]);

  const figures = recipeFigures(recipe);
  return createPortal(
    <div className={styles.root} data-recipe-print data-testid={recipePrintSheetTestIds.root}>
      <h1 className={styles.title}>{source.title}</h1>
      <p className={styles.source}>
        {from} · {source.url.replace(/^https?:\/\/(www\.)?/, "")}
        {figures.length > 0 && (
          <>
            <br />
            {recipeFiguresLine(figures)}
          </>
        )}
        {adjusted !== null && (
          <>
            <br />
            {adjusted}
          </>
        )}
      </p>
      <div className={styles.columns}>
        <div>
          <h2 className={styles.heading}>Ingredients</h2>
          <ul>
            {ingredients.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={styles.heading}>Method</h2>
          {recipe.steps.length === 0 ? (
            <p>
              The method, {recipe.stepCount} steps, is on {from}: {source.url}
            </p>
          ) : (
            recipeStepGroups(recipe.steps).map(({ name, start, steps }) => (
              <div key={start}>
                {name !== null && <h3 className={styles.group}>{name}</h3>}
                <ol start={start}>
                  {steps.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
