import { useEffect, useId, useRef, type ReactNode, type Ref } from "react";
import {
  recipeStepGroups,
  sourceName,
  sourceUrl,
  type MethodAmount,
  type RecipeAction,
  type RecipeNote,
  type Source,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OvenText } from "../OvenText/OvenText.js";
import { RecipeLineChoice } from "./RecipeLineChoice.js";
import { RecipeReadAloud, type RecipeListVoice } from "./RecipeReadAloud.js";
import { useSpokenLineInView } from "./useSpokenLineInView.js";
import styles from "./RecipeMethod.module.scss";
import { recipeMethodTestIds } from "./RecipeMethodTestIds.js";
import { citedPartProps, useCitedOverviewPart } from "../../../chats/CitedOverviewPartContext.js";

export interface RecipeMethodProps {
  recipe: RecipeNote;
  actions: readonly RecipeAction[];
  source: Source;
  note: string | null;
  voice: RecipeListVoice | null;
  cooking: RecipeCooking | null;
  stacked: boolean;
  usTemperatures: boolean;
  methodAmounts: readonly MethodAmount[];
  renderMoment?: ((step: number) => ReactNode) | undefined;
  playingStep?: number | null | undefined;
}

export interface RecipeCooking {
  placeStep: number | null;
  reachedStep: number | null;
  onStart: () => void;
  onCarryOn: () => void;
}

const stepRef = (
  active: boolean,
  reached: boolean,
  spokenLine: Ref<HTMLLIElement>,
  reachedLine: Ref<HTMLLIElement>,
): Ref<HTMLLIElement> | undefined => {
  if (active) {
    return spokenLine;
  }
  return reached ? reachedLine : undefined;
};

const stepTestId = (active: boolean, reached: boolean): string => {
  if (reached) {
    return recipeMethodTestIds.reachedStep;
  }
  return active ? recipeMethodTestIds.activeStep : recipeMethodTestIds.step;
};

// Numbering carries on through the page's groups, so "step 9" means one thing.
export const RecipeMethod = ({
  recipe,
  actions,
  source,
  note,
  voice,
  cooking,
  stacked,
  usTemperatures,
  methodAmounts,
  renderMoment,
  playingStep = null,
}: RecipeMethodProps) => {
  const headingId = useId();
  const cited = useCitedOverviewPart();
  const from = sourceName(source);
  const author = source.kind === "web" ? source.author : null;
  const spokenLine = useSpokenLineInView<HTMLLIElement>(voice?.speaking ?? false, voice?.activeIndex ?? null);
  const spoken = voice?.activeIndex == null ? null : (actions[voice.activeIndex] ?? null);
  const reachedLine = useRef<HTMLLIElement | null>(null);
  const reachedStep = cooking?.reachedStep ?? null;
  useEffect(() => {
    if (reachedStep !== null) {
      reachedLine.current?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [reachedStep]);
  const cookable = cooking !== null && recipe.steps.length > 0;
  const placeStep = cooking?.placeStep ?? null;
  const choose = (step: number) =>
    voice?.onSelect(
      Math.max(
        0,
        actions.findIndex((action) => action.step === step),
      ),
    );
  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid={recipeMethodTestIds.root}>
      <div className={styles.head}>
        <h3 className={styles.heading} id={headingId} {...citedPartProps(cited, "method", "section")}>
          Method{" "}
          <span className={styles.count}>
            · {recipe.stepCount} {recipe.stepCount === 1 ? "step" : "steps"}
          </span>
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
        <button
          type="button"
          className={`${styles.cook} ${styles.cookWide}`}
          onClick={cooking.onStart}
          data-testid={recipeMethodTestIds.cook}
        >
          <StrokeIcon name="chefHat" size={15} />
          Cook step by step
        </button>
      )}

      {recipe.steps.length === 0 ? (
        <>
          <p className={styles.away}>
            The method is in {author === null ? "the author’s" : `${author}’s`} own words, so it stays on {from}.
          </p>
          <a
            className={styles.onThePage}
            href={sourceUrl(source)}
            target="_blank"
            rel="noopener"
            data-testid={recipeMethodTestIds.onThePage}
          >
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
                  const playing = playingStep === number - 1 && !active && !reached;
                  const shown =
                    active && spoken !== null ? (
                      <>
                        <OvenText text={text.slice(0, spoken.start)} us={usTemperatures} amounts={methodAmounts} />
                        <mark className={styles.spoken} data-testid={recipeMethodTestIds.spokenAction}>
                          <OvenText text={text.slice(spoken.start, spoken.end)} us={usTemperatures} amounts={methodAmounts} />
                        </mark>
                        <OvenText text={text.slice(spoken.end)} us={usTemperatures} amounts={methodAmounts} />
                      </>
                    ) : (
                      <OvenText text={text} us={usTemperatures} amounts={methodAmounts} />
                    );
                  return (
                    <li
                      key={number}
                      ref={stepRef(active, reached, spokenLine, reachedLine)}
                      className={`${styles.step} ${voice === null ? "" : styles.stepChoosable} ${active ? styles.stepActive : ""} ${reached ? styles.stepReached : ""} ${playing ? styles.stepPlaying : ""}`}
                      aria-current={playing ? "step" : (voice === null && active) || undefined}
                      {...citedPartProps(cited, "method", number - 1)}
                      onClick={voice === null ? undefined : () => choose(number - 1)}
                      data-testid={stepTestId(active, reached)}
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
                        {renderMoment?.(number - 1)}
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
};
