import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  methodPieces,
  recipeFigures,
  recipeFiguresLine,
  recipeStepGroups,
  type AdjustedIngredient,
  type IngredientPiece,
  type MethodAmount,
  type RecipeNote,
  type WebSource,
} from "@overview/domain";
import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import styles from "./RecipePrintSheet.module.scss";
import { recipePrintSheetTestIds } from "./RecipePrintSheetTestIds.js";

export interface RecipePrintSheetProps {
  source: WebSource;
  from: string;
  recipe: RecipeNote;
  lines: readonly AdjustedIngredient[];
  methodAmounts: readonly MethodAmount[];
  adjusted: string | null;
  onDone: () => void;
}

// Ink may not carry the tint, so on paper a changed amount is set in bold (231l).
function Printed({ pieces }: { pieces: readonly IngredientPiece[] }) {
  return (
    <>
      {pieces.map((piece, index) => (piece.changed ? <strong key={index}>{piece.text}</strong> : <Fragment key={index}>{piece.text}</Fragment>))}
    </>
  );
}

const piecesOf = (line: AdjustedIngredient): IngredientPiece[] => (line.kind === "adjusted" ? line.pieces : [{ text: line.line, changed: false }]);

// Design 144s: the page's recipe on one sheet, black on white whatever the theme, with the
// page's own image above it and our name and mark at the foot, and none of our words
// (OV-148). It exists only while the print dialog is open, which waits for the image.
export function RecipePrintSheet({ source, from, recipe, lines, methodAmounts, adjusted, onDone }: RecipePrintSheetProps) {
  const [imageSettled, setImageSettled] = useState(source.imageUrl === null);

  useEffect(() => {
    window.addEventListener("afterprint", onDone);
    return () => window.removeEventListener("afterprint", onDone);
  }, [onDone]);

  useEffect(() => {
    if (!imageSettled) return;
    const printing = window.setTimeout(() => window.print(), 0);
    return () => window.clearTimeout(printing);
  }, [imageSettled]);

  const figures = recipeFigures(recipe);
  return createPortal(
    <div className={styles.root} data-recipe-print data-testid={recipePrintSheetTestIds.root}>
      {source.imageUrl !== null && (
        <img
          className={styles.image}
          src={source.imageUrl}
          alt=""
          onLoad={() => setImageSettled(true)}
          onError={(event) => {
            event.currentTarget.hidden = true;
            setImageSettled(true);
          }}
          data-testid={recipePrintSheetTestIds.image}
        />
      )}
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
            {adjusted.replace(/\.$/, "")}: changed amounts in bold.
          </>
        )}
      </p>
      <div className={styles.columns}>
        <div>
          <h2 className={styles.heading}>Ingredients</h2>
          <ul>
            {lines.map((line, index) => (
              <li key={index}>
                <Printed pieces={piecesOf(line)} />
              </li>
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
                    <li key={text}>
                      <Printed pieces={methodPieces(text, methodAmounts)} />
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
      </div>
      <p className={styles.madeWith} data-testid={recipePrintSheetTestIds.madeWith}>
        <OverviewMark size={16} />
        Made with The Overview
      </p>
    </div>,
    document.body,
  );
}
