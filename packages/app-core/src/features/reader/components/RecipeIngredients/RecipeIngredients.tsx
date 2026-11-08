import { useId } from "react";
import type { AdjustedIngredient, RecipeUnits } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import {
  MULTIPLIER_LABEL,
  RECIPE_MULTIPLIERS,
  UNITS_LABEL,
  type RecipeAdjustment,
  type RecipeScale,
} from "../../util/recipeAdjustment.js";
import { RecipeLineChoice } from "../RecipeMethod/RecipeLineChoice.js";
import { RecipeReadAloud, type RecipeListVoice } from "../RecipeMethod/RecipeReadAloud.js";
import { useSpokenLineInView } from "../RecipeMethod/useSpokenLineInView.js";
import styles from "./RecipeIngredients.module.scss";
import { recipeIngredientsTestIds } from "./RecipeIngredientsTestIds.js";

const UNIT_CHOICES: readonly RecipeUnits[] = ["asWritten", "metric", "us"];

export interface RecipeIngredientsProps {
  adjustment: RecipeAdjustment;
  scale: RecipeScale;
  units: RecipeUnits;
  // On the wide web the list runs in two columns inside its card (design 144a).
  columns: boolean;
  // A shared page shows the list as written, with no controls (design 144u).
  adjustable: boolean;
  voice: RecipeListVoice | null;
  onScaleChange: (scale: RecipeScale) => void;
  onUnitsChange: (units: RecipeUnits) => void;
  onReset: () => void;
}

function Line({ line }: { line: AdjustedIngredient }) {
  if (line.kind !== "adjusted") {
    return (
      <>
        {line.line}
        {line.kind === "unreadable" && <span className={styles.aside}>· as written</span>}
      </>
    );
  }
  return (
    <>
      {line.pieces.map((piece, index) =>
        piece.changed ? (
          <mark key={index} className={styles.changed} data-testid={recipeIngredientsTestIds.changed}>
            {piece.text}
          </mark>
        ) : (
          <span key={index}>{piece.text}</span>
        ),
      )}
      {line.packAsSold && <span className={styles.aside}>· pack size as sold</span>}
    </>
  );
}

// Designs 144y–144ab: the ingredients on their own raised card, with servings and units at
// its top. As written is where every note opens; changed amounts sit on the stone tint, and
// a line we can't read stays exactly as the page wrote it and says so.
export function RecipeIngredients({
  adjustment,
  scale,
  units,
  columns,
  adjustable,
  voice,
  onScaleChange,
  onUnitsChange,
  onReset,
}: RecipeIngredientsProps) {
  const headingId = useId();
  const groupName = useId();
  const { lines } = adjustment;
  const spokenLine = useSpokenLineInView<HTMLLIElement>(voice?.speaking ?? false, voice?.activeIndex ?? null);
  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={recipeIngredientsTestIds.root}>
      <div className={styles.head}>
        <h3 className={styles.heading} id={headingId}>
          Ingredients <span className={styles.count}>· {lines.length}</span>
        </h3>
        {voice !== null && <RecipeReadAloud voice={voice} label="them" testId={recipeIngredientsTestIds.readAloud} />}
      </div>

      {adjustable && (
        <div className={styles.controls}>
          {scale.kind === "servings" ? (
            <div className={styles.stepper} role="group" aria-label="Servings">
              <button
                type="button"
                className={styles.step}
                aria-label="Fewer"
                disabled={scale.count <= 1}
                onClick={() => onScaleChange({ ...scale, count: scale.count - 1 })}
                data-testid={recipeIngredientsTestIds.fewer}
              >
                <StrokeIcon name="minus" size={14} />
              </button>
              <b className={styles.servings} aria-live="polite" data-testid={recipeIngredientsTestIds.servings}>
                {adjustment.servings}
              </b>
              <button
                type="button"
                className={styles.step}
                aria-label="More"
                onClick={() => onScaleChange({ ...scale, count: scale.count + 1 })}
                data-testid={recipeIngredientsTestIds.more}
              >
                <StrokeIcon name="plus" size={14} />
              </button>
            </div>
          ) : (
            <div className={styles.segments} role="radiogroup" aria-label="Scale">
              {RECIPE_MULTIPLIERS.map((times) => (
                <label key={times} className={styles.segment}>
                  <input
                    className={styles.radio}
                    type="radio"
                    name={`${groupName}-scale`}
                    checked={scale.times === times}
                    onChange={() => onScaleChange({ kind: "multiplier", times })}
                    data-testid={recipeIngredientsTestIds.multiplier(MULTIPLIER_LABEL[times])}
                  />
                  <span className={styles.face}>{MULTIPLIER_LABEL[times]}</span>
                </label>
              ))}
            </div>
          )}
          <div className={styles.segments} role="radiogroup" aria-label="Units">
            {UNIT_CHOICES.map((choice) => (
              <label key={choice} className={styles.segment}>
                <input
                  className={styles.radio}
                  type="radio"
                  name={`${groupName}-units`}
                  checked={units === choice}
                  onChange={() => onUnitsChange(choice)}
                  data-testid={recipeIngredientsTestIds.units(choice)}
                />
                <span className={styles.face}>{UNITS_LABEL[choice]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <ul className={`${styles.list} ${columns ? styles.columns : ""}`}>
        {lines.map((line, index) => {
          const active = voice?.activeIndex === index;
          return (
            <li
              key={index}
              ref={active ? spokenLine : undefined}
              className={`${styles.line} ${voice === null ? "" : styles.lineChoosable} ${active ? styles.lineActive : ""}`}
              aria-current={(voice === null && active) || undefined}
              onClick={voice === null ? undefined : () => voice.onSelect(index)}
              data-testid={active ? recipeIngredientsTestIds.activeLine : recipeIngredientsTestIds.line}
            >
              {voice === null ? (
                <Line line={line} />
              ) : (
                <RecipeLineChoice active={active} onChoose={() => voice.onSelect(index)}>
                  <Line line={line} />
                </RecipeLineChoice>
              )}
            </li>
          );
        })}
      </ul>

      {adjustment.status !== null && (
        <p className={styles.status} role="status" data-testid={recipeIngredientsTestIds.status}>
          <span>{adjustment.status}</span>
          <button type="button" className={styles.reset} onClick={onReset} data-testid={recipeIngredientsTestIds.backToWritten}>
            Back to the recipe as written
          </button>
        </p>
      )}
    </section>
  );
}
