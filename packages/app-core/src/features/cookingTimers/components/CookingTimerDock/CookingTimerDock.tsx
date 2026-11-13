import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { isAppleMobile } from "../../../../util/isAppleMobile.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { CookingTimerBanner } from "../../../reader/components/CookingTimerBanner/CookingTimerBanner.js";
import { TimerRing } from "../../../reader/components/TimerRing/TimerRing.js";
import { isPaused, timeLeftMs, type CookingTimer } from "../../../reader/util/cookingTimers.js";
import { timeLeftWords, timerClock, timerShortName } from "../../../reader/util/timerText.js";
import { useCookingTimers } from "../../CookingTimersContext.js";
import { TimerControlsSheet } from "../TimerControlsSheet/TimerControlsSheet.js";
import { TimersListSheet } from "../TimersListSheet/TimersListSheet.js";
import styles from "./CookingTimerDock.module.scss";
import { cookingTimerDockTestIds } from "./CookingTimerDockTestIds.js";

const CLEARANCE_PROPERTY = "--mini-player-clearance";
const CLEARANCE_GAP_PX = 8;
const SIDE_BY_SIDE = 3;

export interface CookingTimerDockProps {
  // What sits under the timers at the foot: the floating player, where there is one.
  children?: ReactNode;
}

const tileLabel = (timer: CookingTimer, now: number) =>
  `${timerShortName(timer)} timer for ${timer.recipeTitle}, ${isPaused(timer) ? "paused, " : ""}${timeLeftWords(timeLeftMs(timer, now))} left`;

// Where sound can't be counted on outside the mode (designs 288aa, 288ab).
const soundLine = (panel: boolean, awake: boolean): string | null => {
  if (panel) return "Closing the panel stops timers";
  if (awake) return null;
  return isAppleMobile() ? "Keep this screen open to hear your timer" : "Keep this screen on to hear your timer";
};

// Designs 288g–288r and 288w–288ab: the foot of every page. Timers sit above the floating
// player, the same width; with no player they take its place. One timer is a full tile named by
// its recipe, two or three sit side by side, four or more fold into one. A timer that runs out
// rings here, in the tiles' place. The whole dock tells the page how much of the foot it covers.
export function CookingTimerDock({ children }: CookingTimerDockProps) {
  const timers = useCookingTimers();
  const panel = useIsPanel();
  const phone = useIsPhone();
  const root = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [listing, setListing] = useState(false);
  const { running, ringing, now } = timers;
  const any = !timers.cookingOpen && (running.length > 0 || ringing.length > 0);
  const line = any ? soundLine(panel, timers.awake) : null;
  const shownTimer = running.find((timer) => timer.id === shown) ?? null;

  useLayoutEffect(() => {
    const element = root.current;
    if (element === null) return;
    const publish = () => {
      const covered = element.getBoundingClientRect();
      const clearance = covered.height === 0 ? 0 : window.innerHeight - covered.top + CLEARANCE_GAP_PX;
      if (clearance > 0) document.documentElement.style.setProperty(CLEARANCE_PROPERTY, `${clearance}px`);
      else document.documentElement.style.removeProperty(CLEARANCE_PROPERTY);
    };
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(element);
    window.addEventListener("resize", publish);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", publish);
      document.documentElement.style.removeProperty(CLEARANCE_PROPERTY);
    };
  }, []);

  const open = (id: number) => {
    const timer = running.find((candidate) => candidate.id === id);
    if (timer !== undefined) timers.eventsFor(timer).timerOpenedOutside();
    setListing(false);
    setShown(id);
  };

  const tile = (timer: CookingTimer, solo: boolean) => {
    const left = timeLeftMs(timer, now);
    const paused = isPaused(timer);
    return (
      <button
        key={timer.id}
        type="button"
        className={`${styles.tile} ${solo ? styles.solo : ""}`}
        aria-label={tileLabel(timer, now)}
        onClick={() => open(timer.id)}
        data-testid={cookingTimerDockTestIds.tile}
      >
        <TimerRing leftMs={left} totalMs={timer.totalMs} paused={paused} size={solo ? 34 : 28} />
        <span className={styles.name} data-testid={cookingTimerDockTestIds.name}>
          {timerShortName(timer)}
          {paused ? " · paused" : solo ? ` · ${timer.recipeTitle}` : ""}
        </span>
        <span className={styles.time} data-testid={cookingTimerDockTestIds.time}>
          {timerClock(left)}
        </span>
      </button>
    );
  };

  const soonest = running[0];
  return (
    <div ref={root} className={styles.dock} data-testid={cookingTimerDockTestIds.root}>
      {line !== null && (
        <p className={styles.line} data-testid={cookingTimerDockTestIds.line}>
          {line}
        </p>
      )}
      {!any ? null : ringing.length > 0 ? (
        <div className={styles.ringing}>
          <CookingTimerBanner
            ringing={ringing}
            now={now}
            onDismiss={timers.dismiss}
            onMore={(id) => timers.adjust(id, 1)}
            dismissKey={phone || panel ? null : <kbd className={styles.key}>Space</kbd>}
          />
        </div>
      ) : running.length === 1 && soonest !== undefined ? (
        tile(soonest, true)
      ) : running.length > 1 && running.length <= SIDE_BY_SIDE ? (
        <div className={styles.row} role="group" aria-label="Timers, soonest first">
          {running.map((timer) => tile(timer, false))}
        </div>
      ) : soonest !== undefined ? (
        <button
          type="button"
          className={`${styles.tile} ${styles.solo}`}
          aria-label={`${running.length} timers. The soonest has ${timeLeftWords(timeLeftMs(soonest, now))} left`}
          aria-haspopup="dialog"
          onClick={() => setListing(true)}
          data-testid={cookingTimerDockTestIds.folded}
        >
          <TimerRing leftMs={timeLeftMs(soonest, now)} totalMs={soonest.totalMs} paused={isPaused(soonest)} />
          <span className={styles.name}>Timers</span>
          <span className={styles.more}>+{running.length - 1}</span>
          <span className={styles.time}>{timerClock(timeLeftMs(soonest, now))}</span>
        </button>
      ) : null}
      {children}
      {listing && <TimersListSheet open onOpen={open} onClose={() => setListing(false)} />}
      {shownTimer !== null && <TimerControlsSheet timer={shownTimer} onClose={() => setShown(null)} />}
    </div>
  );
}
