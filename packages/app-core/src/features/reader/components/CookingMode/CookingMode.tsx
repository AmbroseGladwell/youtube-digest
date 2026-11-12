import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  formatTimestamp,
  inMethodAmounts,
  inUsOvenTemperatures,
  methodTimes,
  type MethodAmount,
  type MethodTime,
  type RecipeAction,
  type RecipeStep,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { isAppleMobile } from "../../../../util/isAppleMobile.js";
import { useScreenAwake } from "../../../../util/useScreenAwake.js";
import type { CookingMode as CookingModeState, CookingVoice } from "../../ReaderPage/useCookingMode.js";
import { CookingLeaveSheet } from "../CookingLeaveSheet/CookingLeaveSheet.js";
import { CookingIngredientsDrawer } from "../CookingIngredientsDrawer/CookingIngredientsDrawer.js";
import { CookingIngredientsSheet } from "../CookingIngredientsSheet/CookingIngredientsSheet.js";
import { CookingStepsSheet } from "../CookingStepsSheet/CookingStepsSheet.js";
import { CookingStepVideoSheet } from "../CookingStepVideoSheet/CookingStepVideoSheet.js";
import { CookingTimerBanner } from "../CookingTimerBanner/CookingTimerBanner.js";
import { CookingTimerPills } from "../CookingTimerPills/CookingTimerPills.js";
import { CookingTimerSheet } from "../CookingTimerSheet/CookingTimerSheet.js";
import { CookingTimerStrip } from "../CookingTimerStrip/CookingTimerStrip.js";
import { OvenText } from "../OvenText/OvenText.js";
import styles from "./CookingMode.module.scss";
import { cookingModeTestIds } from "./CookingModeTestIds.js";
import { useActionSwipe } from "./useActionSwipe.js";
import { useCookingColumnScale } from "./useCookingColumnScale.js";

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
  methodAmounts: readonly MethodAmount[];
  // A recipe video's id, so a step with a moment can be watched (design 122l); null for a page.
  videoId?: string | null;
  // In the panel the video beside it moves there instead of a sheet opening.
  seekVideo?: ((positionMs: number) => void) | null;
}

const DOTS_UP_TO = 20;
const LONG_ACTION_WORDS = 30;

const wordsIn = (text: string) => text.trim().split(/\s+/).length;

const INTERACTIVE = "button, a, input, select, textarea, [contenteditable]";

const placeOf = (action: RecipeAction) => `Step ${action.step + 1}${action.count === 1 ? "" : ` · ${action.index + 1} of ${action.count}`}`;

function VoiceLine({
  voice,
  step,
  firstScreen,
  onTryAgain,
}: {
  voice: CookingVoice;
  step: number;
  firstScreen: boolean;
  onTryAgain: () => void;
}) {
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
  if (voice === "muted") {
    return (
      <>
        <StrokeIcon name="volumeOff" size={14} />
        <span>Voice muted. The steps are text only</span>
      </>
    );
  }
  if (voice === "paused") return <span>Paused</span>;
  return (
    <>
      <StrokeIcon name="check" size={14} />
      <span>Waiting for you</span>
    </>
  );
}

interface TimedTextProps {
  text: string;
  offset: number;
  times: readonly MethodTime[];
  us: boolean;
  amounts: readonly MethodAmount[];
  onTime: (index: number) => void;
}

// Design 284a: each time in the action is underlined in orange, and tapping it does what its pill does.
function TimedText({ text, offset, times, us, amounts, onTime }: TimedTextProps) {
  const parts: ReactNode[] = [];
  let from = 0;
  times.forEach((time, index) => {
    const start = Math.max(time.start - offset, 0);
    const end = Math.min(time.end - offset, text.length);
    if (end <= from || start >= text.length) return;
    if (start > from) parts.push(<OvenText key={`text${from}`} text={text.slice(from, start)} us={us} amounts={amounts} />);
    parts.push(
      <span
        key={`time${index}`}
        className={styles.time}
        onClick={() => onTime(index)}
        data-swipe-ignore=""
        data-testid={cookingModeTestIds.time}
      >
        {text.slice(start, end)}
      </span>,
    );
    from = end;
  });
  if (from < text.length) parts.push(<OvenText key={`text${from}`} text={text.slice(from)} us={us} amounts={amounts} />);
  return <>{parts}</>;
}

interface ActionTextProps {
  action: RecipeAction;
  times: readonly MethodTime[];
  us: boolean;
  amounts: readonly MethodAmount[];
  onTime: (index: number) => void;
}

function ActionText({ action, times, us, amounts, onTime }: ActionTextProps) {
  if (action.condition === null) return <TimedText text={action.text} offset={0} times={times} us={us} amounts={amounts} onTime={onTime} />;
  return (
    <>
      <b className={styles.condition} data-testid={cookingModeTestIds.condition}>
        <TimedText text={action.condition} offset={0} times={times} us={us} amounts={amounts} onTime={onTime} />
      </b>
      <TimedText
        text={action.text.slice(action.condition.length)}
        offset={action.condition.length}
        times={times}
        us={us}
        amounts={amounts}
        onTime={onTime}
      />
    </>
  );
}

const wakeLineFor = (awake: boolean, timing: boolean, web: boolean): string | null => {
  if (!timing) return awake ? "Screen stays on while you cook" : null;
  if (isAppleMobile()) return awake ? "Screen stays on. Keep it open to hear your timer" : "Keep this screen on to hear your timer";
  if (web) return awake ? "Screen stays on. Keep this tab in front to hear your timer" : "Keep this tab in front to hear your timer";
  return awake ? "Screen stays on while you cook" : "Keep this screen on to hear your timer";
};

// Designs 150c–150au: the action being cooked, large, with the next one under it, and Next the
// biggest thing on the screen. The phone is the main case; the panel is taken over, and the wide
// web is a full-screen takeover with each control's key on it, where the ingredients open as a
// column beside the step (190a–190k) (docs/features/recipe-notes.md, "Cooking step by step").
export function CookingMode({
  mode,
  title,
  from,
  steps,
  actions,
  actionNote,
  ingredients,
  surface,
  usTemperatures,
  methodAmounts,
  videoId = null,
  seekVideo = null,
}: CookingModeProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const ingredientsButton = useRef<HTMLButtonElement | null>(null);
  const drawerId = useId();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const [timerShown, setTimerShown] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const firstPill = useRef<HTMLButtonElement | null>(null);
  const timers = mode.timers;
  const timing = timers.running.length > 0;
  const ringing = timers.ringing.length > 0;
  const awake = useScreenAwake(mode.open && (!mode.finished || timing));
  const action = actions[mode.at];
  const following = actions[mode.at + 1];
  const isLast = mode.at >= actions.length - 1;
  const voiced = mode.voice === "reading" || mode.voice === "waiting" || mode.voice === "paused";
  const mutable = mode.voice !== "textOnly";
  const web = surface === "web";
  const swipe = useActionSwipe(mode.next, () => mode.at > 0 && mode.back(), mode.open && !mode.finished);
  const column = useCookingColumnScale(web && ingredientsOpen);
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
      setWatching(false);
      setTimerShown(null);
      setLeaving(false);
    }
  }, [mode.open]);

  const drawerWasOpen = useRef(false);
  useEffect(() => {
    if (web && drawerWasOpen.current && !ingredientsOpen) ingredientsButton.current?.focus({ preventScroll: true });
    drawerWasOpen.current = web && ingredientsOpen;
  }, [web, ingredientsOpen]);

  useEffect(() => {
    if (!timing) setLeaving(false);
  }, [timing]);

  const leaveNow = () => (mode.finished ? mode.close() : mode.done());
  const leave = () => (timing ? setLeaving(true) : leaveNow());
  const backToRecipe = () => (timing ? setLeaving(true) : mode.close());
  const times = action === undefined ? [] : methodTimes(action.text);
  const shownTimer = timers.running.find((timer) => timer.id === timerShown) ?? null;

  const startTimer = (time: MethodTime, index: number, seconds: number) => {
    if (action === undefined) return;
    timers.start({ name: time.name, step: action.step, source: { action: mode.at, time: index, seconds }, range: time.seconds.length > 1 });
  };

  const onTime = (index: number) => {
    const time = times[index];
    if (time === undefined) return;
    const only = time.seconds.length === 1 ? time.seconds[0]! : null;
    const running = only === null ? undefined : timers.runningFrom({ action: mode.at, time: index, seconds: only });
    if (running !== undefined) setTimerShown(running.id);
    else if (only !== null) startTimer(time, index, only);
    else firstPill.current?.focus();
  };

  const timerKey = () => {
    const only = times.length === 1 && times[0]!.seconds.length === 1;
    if (only) firstPill.current?.click();
    else firstPill.current?.focus();
  };

  const drawerHasTheKey = (event: KeyboardEvent<HTMLDialogElement>) => {
    const target = event.target as HTMLElement;
    return event.key === " " && document.getElementById(drawerId)?.contains(target) === true && target.closest(INTERACTIVE) !== null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || stepsOpen || watching || leaving || shownTimer !== null)
      return;
    const key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      if (ingredientsOpen) setIngredientsOpen(false);
      else leave();
      return;
    }
    if (key === "i" || key === "I") {
      event.preventDefault();
      setIngredientsOpen((shown) => !shown);
      return;
    }
    if ((key === "m" || key === "M") && mutable) {
      event.preventDefault();
      mode.toggleMute("key");
      return;
    }
    if (mode.finished || (ingredientsOpen && !web) || drawerHasTheKey(event)) return;
    if ((key === " " || key === "Enter") && (event.target as HTMLElement).closest("[data-cooking-own-keys] button") !== null) return;
    if ((key === "t" || key === "T") && times.length > 0) {
      event.preventDefault();
      timerKey();
      return;
    }
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
  const narrowColumn = surface === "panel" || (web && column.scale === "narrow");
  const showPreview = following !== undefined && !(narrowColumn && words > LONG_ACTION_WORDS) && !(surface === "panel" && ringing);
  const group = action === undefined ? null : (steps[action.step]?.group ?? null);
  const moment = action === undefined || videoId === null ? undefined : steps[action.step]?.range;
  const key = (label: string) => (web ? <kbd className={styles.key}>{label}</kbd> : null);
  const wakeLine = wakeLineFor(awake, timing, web);
  const timerBlock = (
    <>
      <CookingTimerBanner
        ringing={timers.ringing}
        now={timers.now}
        onDismiss={timers.dismiss}
        onMore={(id) => timers.adjust(id, 1)}
        dismissKey={key("Space")}
      />
      <CookingTimerStrip timers={timers.running} now={timers.now} onOpen={setTimerShown} />
    </>
  );

  return (
    <dialog
      ref={dialog}
      className={`${styles.root} ${styles[surface]} ${web ? styles[column.scale] : ""}`}
      aria-label={`Cooking ${title} step by step`}
      tabIndex={-1}
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
        <div className={`${styles.layout} ${web && ingredientsOpen ? styles.withDrawer : ""}`}>
          {web && <div ref={column.gauge} className={styles.gauge} aria-hidden="true" />}
          <div className={styles.screen}>
            <div className={styles.top}>
              <span className={styles.topStart}>
                <button
                  type="button"
                  className={styles.pill}
                  aria-label="Leave cooking mode"
                  onClick={leave}
                  data-testid={cookingModeTestIds.done}
                >
                  <StrokeIcon name="close" size={16} />
                  Done
                </button>
                <button
                  ref={ingredientsButton}
                  type="button"
                  className={styles.pill}
                  aria-haspopup={web ? undefined : "dialog"}
                  aria-controls={web ? drawerId : undefined}
                  aria-expanded={ingredientsOpen}
                  onClick={() => setIngredientsOpen((shown) => !shown)}
                  data-testid={cookingModeTestIds.ingredients}
                >
                  Ingredients
                  {key("I")}
                </button>
              </span>
              {web && (
                <span className={styles.title} data-testid={cookingModeTestIds.title}>
                  {title}
                </span>
              )}
              <span className={styles.topEnd}>
                {mutable && (
                  <button
                    type="button"
                    className={`${styles.pill} ${styles.mute}`}
                    aria-label="Mute voice"
                    aria-pressed={mode.voice === "muted"}
                    onClick={() => mode.toggleMute("button")}
                    data-testid={cookingModeTestIds.mute}
                  >
                    <StrokeIcon name={mode.voice === "muted" ? "volumeOff" : "volumeOn"} size={18} />
                    {key("M")}
                  </button>
                )}
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
              </span>
            </div>

            {mode.finished ? (
              <div className={styles.end} data-testid={cookingModeTestIds.end}>
                {timerBlock}
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
                  <button type="button" className={styles.next} onClick={backToRecipe} data-testid={cookingModeTestIds.backToRecipe}>
                    Back to the recipe
                  </button>
                </div>
              </div>
            ) : (
              <>
                {steps.length <= DOTS_UP_TO ? (
                  <div className={styles.dots} aria-hidden="true" data-testid={cookingModeTestIds.progress}>
                    {steps.map((_, index) => (
                      <i key={index} className={index < action.step ? styles.dotDone : undefined}>
                        {index === action.step && (
                          <b
                            className={styles.dotFill}
                            style={{ width: `${((action.index + 1) / action.count) * 100}%` }}
                            data-testid={cookingModeTestIds.stepFill}
                          />
                        )}
                      </i>
                    ))}
                  </div>
                ) : (
                  <div className={styles.line} aria-hidden="true" data-testid={cookingModeTestIds.progress}>
                    <b style={{ width: `${((mode.at + 1) / actions.length) * 100}%` }} />
                  </div>
                )}

                {timerBlock}

                <div className={styles.stage}>
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
                      <ActionText action={action} times={times} us={usTemperatures} amounts={methodAmounts} onTime={onTime} />
                    </p>
                    <CookingTimerPills
                      times={times}
                      action={mode.at}
                      runningFrom={timers.runningFrom}
                      onStart={startTimer}
                      onOpen={setTimerShown}
                      firstPill={firstPill}
                      firstKey={key("T")}
                    />
                    {showPreview && (
                      <div className={styles.preview} data-testid={cookingModeTestIds.next}>
                        <b data-testid={cookingModeTestIds.nextLead}>
                          {following.step === action.step ? "Then" : `Then step ${following.step + 1}`}
                        </b>
                        <span>
                          <OvenText text={following.text} us={usTemperatures} amounts={methodAmounts} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <p className={styles.announce} aria-live="polite">
                  {`${placeOf(action).replace(" · ", ", ")}. ${usTemperatures ? inUsOvenTemperatures(inMethodAmounts(action.text, methodAmounts)) : inMethodAmounts(action.text, methodAmounts)}`}
                </p>

                {moment !== undefined && (
                  <div className={styles.watchRow}>
                    <button
                      type="button"
                      className={styles.watch}
                      aria-label={`Watch step ${action.step + 1} in the video, from ${formatTimestamp(moment.startMs)}`}
                      onClick={() => (seekVideo === null ? setWatching(true) : seekVideo(moment.startMs))}
                      data-testid={cookingModeTestIds.watchStep}
                    >
                      <StrokeIcon name="play" size={13} />
                      Watch this step · {formatTimestamp(moment.startMs)}
                    </button>
                  </div>
                )}

                <div className={styles.voice} role="status" data-testid={cookingModeTestIds.voice}>
                  {ringing && mode.voice !== "muted" ? (
                    <>
                      <span className={styles.ringing}>
                        <StrokeIcon name="bell" size={14} />
                        Timer ringing
                      </span>
                      <span>· the voice waits</span>
                    </>
                  ) : (
                    <VoiceLine voice={mode.voice} step={action.step + 1} firstScreen={mode.firstScreen} onTryAgain={mode.tryAgain} />
                  )}
                </div>

                {mode.hint && voiced && (
                  <p className={styles.hint} data-testid={cookingModeTestIds.hint}>
                    <StrokeIcon name="headphones" size={14} />
                    <span>Your headphones’ play button moves to the next step</span>
                    <button
                      type="button"
                      className={styles.dismiss}
                      aria-label="Dismiss"
                      onClick={mode.dismissHint}
                      data-testid={cookingModeTestIds.dismissHint}
                    >
                      <StrokeIcon name="close" size={12} />
                    </button>
                  </p>
                )}

                <div className={`${styles.controls} ${voiced ? "" : styles.controlsQuiet}`}>
                  <button
                    type="button"
                    className={styles.control}
                    disabled={mode.at === 0}
                    onClick={mode.back}
                    data-testid={cookingModeTestIds.back}
                  >
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
                    {!ringing && key("Space")}
                  </button>
                </div>
              </>
            )}

            {wakeLine !== null && (!mode.finished || timing) && (
              <p className={styles.awake} data-testid={cookingModeTestIds.awake}>
                <StrokeIcon name={awake ? "sun" : "timer"} size={13} />
                {wakeLine}
              </p>
            )}

            {moment !== undefined && videoId !== null && action !== undefined && (
              <CookingStepVideoSheet
                open={watching}
                videoId={videoId}
                step={action.step + 1}
                range={moment}
                onClose={() => setWatching(false)}
              />
            )}
            <CookingTimerSheet
              timer={shownTimer}
              now={timers.now}
              onPause={timers.pause}
              onResume={timers.resume}
              onAdjust={timers.adjust}
              onCancel={(id) => {
                timers.cancel(id);
                setTimerShown(null);
              }}
              onClose={() => setTimerShown(null)}
            />
            <CookingLeaveSheet
              open={leaving}
              timers={timers.running}
              now={timers.now}
              web={web}
              keepKey={key("Esc")}
              onKeep={() => setLeaving(false)}
              onLeave={() => {
                setLeaving(false);
                leaveNow();
              }}
            />
            <CookingStepsSheet
              open={stepsOpen}
              steps={steps}
              actions={actions}
              at={mode.at}
              usTemperatures={usTemperatures}
              methodAmounts={methodAmounts}
              onChoose={(step) => {
                setStepsOpen(false);
                mode.goToStep(step);
              }}
              onClose={() => setStepsOpen(false)}
            />
            {!web && (
              <CookingIngredientsSheet open={ingredientsOpen} onClose={() => setIngredientsOpen(false)}>
                {ingredients}
              </CookingIngredientsSheet>
            )}
          </div>
          {web && (
            <CookingIngredientsDrawer
              id={drawerId}
              open={ingredientsOpen}
              onClose={() => setIngredientsOpen(false)}
              onSettled={column.onDrawerSettled}
            >
              {ingredients}
            </CookingIngredientsDrawer>
          )}
        </div>
      )}
    </dialog>
  );
}
