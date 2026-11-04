import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { inUsOvenTemperatures, type RecipeAction, type RecipeStep } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useScreenAwake } from "../../../../util/useScreenAwake.js";
import type { CookingMode as CookingModeState, CookingVoice } from "../../ReaderPage/useCookingMode.js";
import { CookingIngredientsSheet } from "../CookingIngredientsSheet/CookingIngredientsSheet.js";
import { CookingStepsSheet } from "../CookingStepsSheet/CookingStepsSheet.js";
import { OvenText } from "../OvenText/OvenText.js";
import styles from "./CookingMode.module.scss";
import { cookingModeTestIds } from "./CookingModeTestIds.js";
import { useActionSwipe } from "./useActionSwipe.js";

export type CookingSurface = "phone" | "panel" | "web";

export interface CookingModeProps {
  mode: CookingModeState;
  title: string;
  from: string;
  steps: readonly RecipeStep[];
  actions: readonly RecipeAction[];
  actionNote: string | null;
  ingredients: ReactNode;
  surface: CookingSurface;
  usTemperatures: boolean;
}

const DOTS_UP_TO = 20;
const LONG_ACTION_WORDS = 30;

const wordsIn = (text: string) => text.trim().split(/\s+/).length;

const placeOf = (action: RecipeAction) => `Step ${action.step + 1}${action.count === 1 ? "" : ` · ${action.index + 1} of ${action.count}`}`;

function VoiceLine({ voice, step, firstScreen, onTryAgain }: { voice: CookingVoice; step: number; firstScreen: boolean; onTryAgain: () => void }) {
  if (voice === "reading") {
    return (
      <>
        <span className={styles.level} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Reading step {step}</span>
      </>
    );
  }
  if (voice === "loading") {
    return (
      <>
        <span className={styles.spinner} aria-hidden="true" />
        <span>The voice is on its way. Read on; it joins you when it’s ready</span>
      </>
    );
  }
  if (voice === "stopped") {
    return (
      <span className={styles.stopped}>
        <StrokeIcon name="alertCircle" size={14} />
        <span>The voice stopped</span>
        <button type="button" className={styles.tryAgain} onClick={onTryAgain} data-testid={cookingModeTestIds.tryAgain}>
          Try again
        </button>
      </span>
    );
  }
  if (voice === "textOnly") {
    return firstScreen ? (
      <>
        <StrokeIcon name="textOnly" size={14} />
        <span>No narration on this recipe, so it’s text only</span>
      </>
    ) : null;
  }
  if (voice === "paused") return <span>Paused</span>;
  return (
    <>
      <StrokeIcon name="check" size={14} />
      <span>Waiting for you</span>
    </>
  );
}

function ActionText({ action, us }: { action: RecipeAction; us: boolean }) {
  if (action.condition === null) return <OvenText text={action.text} us={us} />;
  return (
    <>
      <b className={styles.condition} data-testid={cookingModeTestIds.condition}>
        <OvenText text={action.condition} us={us} />
      </b>
      <OvenText text={action.text.slice(action.condition.length)} us={us} />
    </>
  );
}

// Designs 150c–150au: the action being cooked, large, with the next one under it, and Next the
// biggest thing on the screen. The phone is the main case; the panel is taken over, and the wide
// web is a full-screen takeover with each control's key on it (docs/features/recipe-notes.md,
// "Cooking step by step").
export function CookingMode({ mode, title, from, steps, actions, actionNote, ingredients, surface, usTemperatures }: CookingModeProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const awake = useScreenAwake(mode.open && !mode.finished);
  const action = actions[mode.at];
  const following = actions[mode.at + 1];
  const isLast = mode.at >= actions.length - 1;
  const voiced = mode.voice === "reading" || mode.voice === "waiting" || mode.voice === "paused";
  const web = surface === "web";
  const swipe = useActionSwipe(mode.next, () => mode.at > 0 && mode.back(), mode.open && !mode.finished);
  const [arrival, setArrival] = useState<{ at: number; from: "below" | "above" | null }>({ at: mode.at, from: null });
  if (arrival.at !== mode.at) setArrival({ at: mode.at, from: mode.at > arrival.at ? "below" : "above" });

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (mode.open && !element.open) element.showModal();
    if (!mode.open && element.open) element.close();
  }, [mode.open]);

  useEffect(() => {
    if (!mode.open) {
      setStepsOpen(false);
      setIngredientsOpen(false);
    }
  }, [mode.open]);

  const leave = () => (mode.finished ? mode.close() : mode.done());

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || stepsOpen) return;
    const key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      if (!ingredientsOpen) leave();
      return;
    }
    if (key === "i" || key === "I") {
      event.preventDefault();
      setIngredientsOpen((shown) => !shown);
      return;
    }
    if (ingredientsOpen || mode.finished) return;
    if (key === " " || key === "ArrowRight") {
      event.preventDefault();
      mode.next();
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      if (mode.at > 0) mode.back();
    } else if ((key === "r" || key === "R") && voiced) {
      event.preventDefault();
      mode.again();
    }
  };

  const words = action === undefined ? 0 : wordsIn(action.text);
  const length = Math.min(Math.max((words - 3) / 27, 0), 1);
  const showPreview = following !== undefined && !(surface === "panel" && words > LONG_ACTION_WORDS);
  const group = action === undefined ? null : (steps[action.step]?.group ?? null);
  const key = (label: string) => (web ? <kbd className={styles.key}>{label}</kbd> : null);

  return (
    <dialog
      ref={dialog}
      className={`${styles.root} ${styles[surface]}`}
      aria-label={`Cooking ${title} step by step`}
      onCancel={(event) => {
        event.preventDefault();
        if (event.target !== dialog.current) return;
        if (stepsOpen) setStepsOpen(false);
        else if (ingredientsOpen) setIngredientsOpen(false);
        else leave();
      }}
      onKeyDown={onKeyDown}
      data-testid={cookingModeTestIds.root}
    >
      {mode.open && action !== undefined && (
        <div className={`${styles.screen} ${web && ingredientsOpen ? styles.besideDrawer : ""}`}>
          <div className={styles.top}>
            <span className={styles.topStart}>
              <button type="button" className={styles.pill} aria-label="Leave cooking mode" onClick={leave} data-testid={cookingModeTestIds.done}>
                <StrokeIcon name="close" size={16} />
                Done
              </button>
              <button
                type="button"
                className={styles.pill}
                aria-haspopup="dialog"
                aria-expanded={ingredientsOpen}
                onClick={() => setIngredientsOpen((shown) => !shown)}
                data-testid={cookingModeTestIds.ingredients}
              >
                Ingredients
                {key("I")}
              </button>
            </span>
            {web && <span className={styles.title}>{title}</span>}
            <button
              type="button"
              className={styles.pill}
              aria-label={`Step ${action.step + 1} of ${steps.length}. All steps`}
              aria-haspopup="dialog"
              onClick={() => setStepsOpen(true)}
              data-testid={cookingModeTestIds.steps}
            >
              <StrokeIcon name="list" size={15} />
              {action.step + 1} of {steps.length}
            </button>
          </div>

          {mode.finished ? (
            <div className={styles.end} data-testid={cookingModeTestIds.end}>
              <div className={styles.endBody}>
                <p className={styles.place}>All {steps.length} steps</p>
                <p className={styles.endLine} role="status">
                  That’s the method.
                </p>
                <p className={styles.endFrom}>
                  {title}, from {from}.
                </p>
              </div>
              <div className={styles.controls}>
                <button type="button" className={styles.control} onClick={mode.lastStep} data-testid={cookingModeTestIds.lastStep}>
                  <StrokeIcon name="arrowLeft" size={18} />
                  Last step
                </button>
                <button type="button" className={styles.control} onClick={mode.startAgain} data-testid={cookingModeTestIds.startAgain}>
                  <StrokeIcon name="rotateCcw" size={18} />
                  Start again
                </button>
                <button type="button" className={styles.next} onClick={mode.close} data-testid={cookingModeTestIds.backToRecipe}>
                  Back to the recipe
                </button>
              </div>
            </div>
          ) : (
            <>
              {steps.length <= DOTS_UP_TO ? (
                <div className={styles.dots} aria-hidden="true" data-testid={cookingModeTestIds.progress}>
                  {steps.map((_, index) => (
                    <i key={index} className={index < action.step ? styles.dotDone : index === action.step ? styles.dotHere : undefined} />
                  ))}
                </div>
              ) : (
                <div className={styles.line} aria-hidden="true" data-testid={cookingModeTestIds.progress}>
                  <b style={{ width: `${((mode.at + 1) / actions.length) * 100}%` }} />
                </div>
              )}

              <div
                key={mode.at}
                className={`${styles.main} ${arrival.from === "below" ? styles.fromBelow : arrival.from === "above" ? styles.fromAbove : ""} ${swipe.dragging ? styles.dragging : ""}`}
                style={swipe.dragY === 0 ? undefined : { transform: `translateY(${swipe.dragY}px)` }}
                {...swipe.handlers}
                data-testid={cookingModeTestIds.swipeArea}
              >
                {group !== null && (
                  <p className={styles.group} data-testid={cookingModeTestIds.group}>
                    {group}
                  </p>
                )}
                <p className={styles.place} data-testid={cookingModeTestIds.place}>
                  {placeOf(action)}
                </p>
                {actionNote !== null && (
                  <p className={styles.note} data-testid={cookingModeTestIds.note}>
                    {actionNote}
                  </p>
                )}
                {action.label !== null && (
                  <p className={styles.label} data-testid={cookingModeTestIds.label}>
                    {action.label}
                  </p>
                )}
                <p className={styles.action} style={{ "--length": length } as CSSProperties} data-testid={cookingModeTestIds.action}>
                  <ActionText action={action} us={usTemperatures} />
                </p>
                {showPreview && (
                  <div className={styles.preview} data-testid={cookingModeTestIds.next}>
                    <b data-testid={cookingModeTestIds.nextLead}>{following.step === action.step ? "Then" : `Then step ${following.step + 1}`}</b>
                    <span>
                      <OvenText text={following.text} us={usTemperatures} />
                    </span>
                  </div>
                )}
              </div>

              <p className={styles.announce} aria-live="polite">
                {`${placeOf(action).replace(" · ", ", ")}. ${usTemperatures ? inUsOvenTemperatures(action.text) : action.text}`}
              </p>

              <div className={styles.voice} role="status" data-testid={cookingModeTestIds.voice}>
                <VoiceLine voice={mode.voice} step={action.step + 1} firstScreen={mode.firstScreen} onTryAgain={mode.tryAgain} />
              </div>

              {mode.hint && voiced && (
                <p className={styles.hint} data-testid={cookingModeTestIds.hint}>
                  <StrokeIcon name="headphones" size={14} />
                  <span>Your headphones’ play button moves to the next step</span>
                  <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={mode.dismissHint} data-testid={cookingModeTestIds.dismissHint}>
                    <StrokeIcon name="close" size={12} />
                  </button>
                </p>
              )}

              <div className={`${styles.controls} ${voiced ? "" : styles.controlsQuiet}`}>
                <button type="button" className={styles.control} disabled={mode.at === 0} onClick={mode.back} data-testid={cookingModeTestIds.back}>
                  <StrokeIcon name="arrowLeft" size={18} />
                  Back
                  {key("←")}
                </button>
                {voiced && (
                  <button type="button" className={styles.control} onClick={mode.again} data-testid={cookingModeTestIds.again}>
                    <StrokeIcon name="rotateCcw" size={18} />
                    Say it again
                    {key("R")}
                  </button>
                )}
                <button type="button" className={styles.next} onClick={mode.next} data-testid={cookingModeTestIds.forward}>
                  {isLast ? "Finish" : "Next"}
                  {isLast ? <StrokeIcon name="check" size={26} /> : <StrokeIcon name="arrowRight" size={26} />}
                  {key("Space")}
                </button>
              </div>
            </>
          )}

          {awake && !mode.finished && (
            <p className={styles.awake} data-testid={cookingModeTestIds.awake}>
              <StrokeIcon name="sun" size={13} />
              Screen stays on while you cook
            </p>
          )}

          <CookingStepsSheet
            open={stepsOpen}
            steps={steps}
            actions={actions}
            at={mode.at}
            usTemperatures={usTemperatures}
            onChoose={(step) => {
              setStepsOpen(false);
              mode.goToStep(step);
            }}
            onClose={() => setStepsOpen(false)}
          />
          <CookingIngredientsSheet open={ingredientsOpen} drawer={web} onClose={() => setIngredientsOpen(false)}>
            {ingredients}
          </CookingIngredientsSheet>
        </div>
      )}
    </dialog>
  );
}
