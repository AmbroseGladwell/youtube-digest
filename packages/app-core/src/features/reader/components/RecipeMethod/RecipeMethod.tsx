import { useEffect, useId, useRef } from "react";
import { recipeStepGroups, sourceName, type RecipeAction, type RecipeNote, type WebSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OvenText } from "../OvenText/OvenText.js";
import { RecipeLineChoice } from "./RecipeLineChoice.js";
import { RecipeReadAloud, type RecipeListVoice } from "./RecipeReadAloud.js";
import { useSpokenLineInView } from "./useSpokenLineInView.js";
import styles from "./RecipeMethod.module.scss";
import { recipeMethodTestIds } from "./RecipeMethodTestIds.js";

export interface RecipeMethodProps {
  recipe: RecipeNote;
  // The voice moves through these, so its place is an action and the tint a sentence (design 150ac).
  actions: readonly RecipeAction[];
  source: WebSource;
  // Said once above step 1 when the ingredients were adjusted: the method keeps the author's.
  note: string | null;
  voice: RecipeListVoice | null;
  cooking: RecipeCooking | null;
  // On a phone the way into cooking runs full width under the heading (design 150b).
  stacked: boolean;
  usTemperatures: boolean;
}

// The way into cooking step by step (designs 150a, 150w): from step 1, or from where the reader
// left it, whose step stays tinted until they go on.
export interface RecipeCooking {
  placeStep: number | null;
  reachedStep: number | null;
  onStart: () => void;
  onCarryOn: () => void;
}

// Designs 144g and 144u: a numbered list whose numbering carries on through the page's own
// groups, so "step 9" means one thing. Where the method stayed on the page, a shared copy and
// one saved from it, the heading keeps its count and the page is one link away.
export function RecipeMethod({ recipe, actions, source, note, voice, cooking, stacked, usTemperatures }: RecipeMethodProps) {
  const headingId = useId();
  const from = sourceName(source);
  const spokenLine = useSpokenLineInView<HTMLLIElement>(voice?.speaking ?? false, voice?.activeIndex ?? null);
  const spoken = voice?.activeIndex == null ? null : (actions[voice.activeIndex] ?? null);
  const reachedLine = useRef<HTMLLIElement | null>(null);
  const reachedStep = cooking?.reachedStep ?? null;
  useEffect(() => {
    if (reachedStep !== null) reachedLine.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [reachedStep]);
  const cookable = cooking !== null && recipe.steps.length > 0;
  const placeStep = cooking?.placeStep ?? null;
  const choose = (step: number) => voice?.onSelect(Math.max(0, actions.findIndex((action) => action.step === step)));
  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={recipeMethodTestIds.root}>
      <div className={styles.head}>
        <h3 className={styles.heading} id={headingId}>
          Method <span className={styles.count}>· {recipe.stepCount} {recipe.stepCount === 1 ? "step" : "steps"}</span>
        </h3>
        <span className={styles.headActions}>
          {voice !== null && recipe.steps.length > 0 && <RecipeReadAloud voice={voice} label="it" testId={recipeMethodTestIds.readAloud} />}
          {cookable && !stacked && placeStep === null && (
            <button type="button" className={styles.cook} onClick={cooking.onStart} data-testid={recipeMethodTestIds.cook}>
              <StrokeIcon name="chefHat" size={15} />
              Cook step by step
            </button>
          )}
        </span>
      </div>
      {cookable && placeStep !== null && (
        <>
          <p className={styles.stopped} role="status" data-testid={recipeMethodTestIds.stopped}>
            You stopped at step {placeStep + 1} of {recipe.stepCount}.
          </p>
          <div className={styles.carryOn}>
            <button type="button" className={styles.cook} onClick={cooking.onCarryOn} data-testid={recipeMethodTestIds.carryOn}>
              <StrokeIcon name="chefHat" size={15} />
              Carry on from step {placeStep + 1}
            </button>
            <button type="button" className={styles.startOver} onClick={cooking.onStart} data-testid={recipeMethodTestIds.startOver}>
              Start from step 1
            </button>
          </div>
        </>
      )}
      {cookable && stacked && placeStep === null && (
        <button type="button" className={`${styles.cook} ${styles.cookWide}`} onClick={cooking.onStart} data-testid={recipeMethodTestIds.cook}>
          <StrokeIcon name="chefHat" size={15} />
          Cook step by step
        </button>
      )}

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
                  const reached = (reachedStep ?? placeStep) === number - 1 && !(voice?.speaking ?? false);
                  const active = spoken?.step === number - 1 && !reached;
                  const shown =
                    active && spoken !== null ? (
                      <>
                        <OvenText text={text.slice(0, spoken.start)} us={usTemperatures} />
                        <mark className={styles.spoken} data-testid={recipeMethodTestIds.spokenAction}>
                          <OvenText text={text.slice(spoken.start, spoken.end)} us={usTemperatures} />
                        </mark>
                        <OvenText text={text.slice(spoken.end)} us={usTemperatures} />
                      </>
                    ) : (
                      <OvenText text={text} us={usTemperatures} />
                    );
                  return (
                    <li
                      key={number}
                      ref={active ? spokenLine : reached ? reachedLine : undefined}
                      className={`${styles.step} ${voice === null ? "" : styles.stepChoosable} ${active ? styles.stepActive : ""} ${reached ? styles.stepReached : ""}`}
                      aria-current={(voice === null && active) || undefined}
                      onClick={voice === null ? undefined : () => choose(number - 1)}
                      data-testid={reached ? recipeMethodTestIds.reachedStep : active ? recipeMethodTestIds.activeStep : recipeMethodTestIds.step}
                    >
                      <i className={styles.number} aria-hidden="true">
                        {number}
                      </i>
                      <div>
                        {voice === null ? (
                          shown
                        ) : (
                          <RecipeLineChoice active={active} onChoose={() => choose(number - 1)}>
                            {shown}
                          </RecipeLineChoice>
                        )}
                      </div>
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
