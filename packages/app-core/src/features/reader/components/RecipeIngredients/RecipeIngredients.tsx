import { useId } from "react";
import type { AdjustedIngredient, RecipeUnits } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { MULTIPLIER_LABEL, RECIPE_MULTIPLIERS, UNITS_LABEL, type RecipeAdjustment, type RecipeScale } from "../../util/recipeAdjustment.js";
import { RecipeLineChoice } from "../RecipeMethod/RecipeLineChoice.js";
import { RecipeReadAloud, type RecipeListVoice } from "../RecipeMethod/RecipeReadAloud.js";
import { useSpokenLineInView } from "../RecipeMethod/useSpokenLineInView.js";
import styles from "./RecipeIngredients.module.scss";
import { recipeIngredientsTestIds } from "./RecipeIngredientsTestIds.js";
import { citedPartProps, useCitedOverviewPart } from "../../../chats/CitedOverviewPartContext.js";

const UNIT_CHOICES: readonly RecipeUnits[] = ["asWritten", "metric", "us"];

export interface RecipeIngredientsProps {
  adjustment: RecipeAdjustment;
  scale: RecipeScale;
  units: RecipeUnits;
  columns: boolean;
  adjustable: boolean;
  voice: RecipeListVoice | null;
  // The lines a video said rather than its description listed; null for a page's recipe.
  said: readonly number[] | null;
  onScaleChange: (scale: RecipeScale) => void;
  onUnitsChange: (units: RecipeUnits) => void;
  onReset: () => void;
}

const HAS_A_FIGURE = /\d|[¼½¾⅓⅔⅛]/;

const unreadableAside = (line: string, fromVideo: boolean): string => {
  if (!fromVideo) {
    return "· as written";
  }
  return HAS_A_FIGURE.test(line) || /\b(?:half|quarter|third|one|two|three|four|five|six|dozen)\b/i.test(line)
    ? "· as said"
    : "· no amount said";
};

export const ingredientsSource = (said: readonly number[], total: number): string => {
  if (said.length === total) {
    return "As said in the video. Where no amount is said, the line has none.";
  }
  return said.length === 0 ? "From the video’s description." : `From the video’s description, with ${said.length} said in the video.`;
};

interface LineProps {
  line: AdjustedIngredient;
  fromVideo: boolean;
  saidAside: boolean;
}

const Line = ({ line, fromVideo, saidAside }: LineProps) => {
  if (line.kind !== "adjusted") {
    return (
      <>
        {line.line}
        {line.kind === "unreadable" && <span className={styles.aside}>{unreadableAside(line.line, fromVideo)}</span>}
        {saidAside && <span className={styles.aside}>· said in the video</span>}
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
      {saidAside && <span className={styles.aside}>· said in the video</span>}
    </>
  );
};

export const RecipeIngredients = ({
  adjustment,
  scale,
  units,
  columns,
  adjustable,
  voice,
  said,
  onScaleChange,
  onUnitsChange,
  onReset,
}: RecipeIngredientsProps) => {
  const headingId = useId();
  const cited = useCitedOverviewPart();
  const groupName = useId();
  const { lines } = adjustment;
  const spokenLine = useSpokenLineInView<HTMLLIElement>(voice?.speaking ?? false, voice?.activeIndex ?? null);
  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={recipeIngredientsTestIds.root}>
      <div className={styles.head}>
        <h3 className={styles.heading} id={headingId} {...citedPartProps(cited, "ingredient", "section")}>
          Ingredients <span className={styles.count}>· {lines.length}</span>
        </h3>
        {voice !== null && <RecipeReadAloud voice={voice} label="them" testId={recipeIngredientsTestIds.readAloud} />}
      </div>
      {said !== null && (
        <p className={styles.source} data-testid={recipeIngredientsTestIds.source}>
          {ingredientsSource(said, lines.length)}
        </p>
      )}

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
              {...citedPartProps(cited, "ingredient", index)}
              data-testid={active ? recipeIngredientsTestIds.activeLine : recipeIngredientsTestIds.line}
            >
              {voice === null ? (
                <Line
                  line={line}
                  fromVideo={said !== null}
                  saidAside={said !== null && said.length < lines.length && said.includes(index)}
                />
              ) : (
                <RecipeLineChoice active={active} onChoose={() => voice.onSelect(index)}>
                  <Line
                    line={line}
                    fromVideo={said !== null}
                    saidAside={said !== null && said.length < lines.length && said.includes(index)}
                  />
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
};
