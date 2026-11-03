import { useId } from "react";
import { recipeStepGroups, sourceName, type RecipeNote, type WebSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { RecipeReadAloud, type RecipeListVoice } from "./RecipeReadAloud.js";
import styles from "./RecipeMethod.module.scss";
import { recipeMethodTestIds } from "./RecipeMethodTestIds.js";

export interface RecipeMethodProps {
  recipe: RecipeNote;
  source: WebSource;
  // Said once above step 1 when the ingredients were adjusted: the method keeps the author's.
  note: string | null;
  voice: RecipeListVoice | null;
}

// Designs 144g and 144u: a numbered list whose numbering carries on through the page's own
// groups, so "step 9" means one thing. Where the method stayed on the page, a shared copy and
// one saved from it, the heading keeps its count and the page is one link away.
export function RecipeMethod({ recipe, source, note, voice }: RecipeMethodProps) {
  const headingId = useId();
  const from = sourceName(source);
  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={recipeMethodTestIds.root}>
      <div className={styles.head}>
        <h3 className={styles.heading} id={headingId}>
          Method <span className={styles.count}>· {recipe.stepCount} {recipe.stepCount === 1 ? "step" : "steps"}</span>
        </h3>
        {voice !== null && recipe.steps.length > 0 && <RecipeReadAloud voice={voice} label="it" testId={recipeMethodTestIds.readAloud} />}
      </div>

      {recipe.steps.length === 0 ? (
        <>
          <p className={styles.away}>
            The method is in {source.author === null ? "the author’s" : `${source.author}’s`} own words, so it stays on {from}.
          </p>
          <a className={styles.onThePage} href={source.url} target="_blank" rel="noopener" data-testid={recipeMethodTestIds.onThePage}>
            See the method on {from}
            <StrokeIcon name="openOut" size={13} />
          </a>
        </>
      ) : (
        <>
          {note !== null && (
            <p className={styles.note} data-testid={recipeMethodTestIds.note}>
              {note}
            </p>
          )}
          {recipeStepGroups(recipe.steps).map(({ name, start, steps }) => (
            <div key={start} className={styles.group}>
              {name !== null && (
                <h4 className={styles.groupName} data-testid={recipeMethodTestIds.group}>
                  {name}
                </h4>
              )}
              <ol className={styles.steps} start={start}>
                {steps.map((text, index) => {
                  const number = start + index;
                  const active = voice?.activeIndex === number - 1;
                  return (
                    <li
                      key={number}
                      className={`${styles.step} ${active ? styles.stepActive : ""}`}
                      aria-current={active || undefined}
                      data-testid={active ? recipeMethodTestIds.activeStep : recipeMethodTestIds.step}
                    >
                      <i className={styles.number} aria-hidden="true">
                        {number}
                      </i>
                      <div>{text}</div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
