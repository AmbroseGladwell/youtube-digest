import { recipeActions, type OverviewId } from "@overview/domain";
import { useNavigate } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useQuery } from "@tanstack/react-query";
import { overviewWithStateQueryOptions } from "../../../overviews/queries/overviewWithStateQuery.js";
import { useStores } from "../../../../stores/StoresContext.js";
import { CookingTimerSheet } from "../../../reader/components/CookingTimerSheet/CookingTimerSheet.js";
import type { CookingTimer } from "../../../reader/util/cookingTimers.js";
import { useKeptWhileClosing } from "../../../../util/useKeptWhileClosing.js";
import { useCookingTimers } from "../../CookingTimersContext.js";
import styles from "./TimerControlsSheet.module.scss";
import { timerControlsSheetTestIds } from "./TimerControlsSheetTestIds.js";

export interface TimerControlsSheetProps {
  timer: CookingTimer | null;
  onClose: () => void;
  onLeaving?: () => void;
}

type WayBack = "step" | "start" | "gone" | "unknown";

// Looked up afresh each time, since the recipe may have changed or gone; a shared page can't.
const useWayBack = (timer: CookingTimer): WayBack => {
  const { scope } = useCookingTimers();
  const { overviewStore } = useStores();
  const query = useQuery({
    ...overviewWithStateQueryOptions(overviewStore, timer.source.recipe as OverviewId),
    enabled: scope === "reader",
    refetchOnMount: "always",
  });
  if (scope === "sharedPage") {
    return "step";
  }
  if (query.isPending || query.isFetching) {
    return "unknown";
  }
  const recipe = query.data?.overview.recipe ?? null;
  if (recipe === null) {
    return "gone";
  }
  return recipeActions(recipe.steps)[timer.source.action]?.text === timer.actionText ? "step" : "start";
};

interface TimerWayBackProps {
  timer: CookingTimer;
  onLeaving: (() => void) | undefined;
  onClose: () => void;
}

// Mounted with the sheet's body, so each opening looks the recipe up again.
const TimerWayBack = ({ timer, onLeaving, onClose }: TimerWayBackProps) => {
  const timers = useCookingTimers();
  const navigate = useNavigate();
  const wayBack = useWayBack(timer);

  if (wayBack === "unknown") {
    return null;
  }
  if (wayBack === "gone") {
    return (
      <p className={styles.gone} data-testid={timerControlsSheetTestIds.gone}>
        This note was deleted, so there’s no step to go back to. The timer carries on.
      </p>
    );
  }
  const goBack = () => {
    timers.eventsFor(timer).backToStep({ landed: wayBack });
    onLeaving?.();
    onClose();
    timers.requestCook({ recipe: timer.source.recipe, action: timer.source.action, actionText: timer.actionText });
    if (timers.scope === "reader") {
      void navigate(Routes.overview(timer.source.recipe as OverviewId));
    }
  };
  return (
    <button type="button" className={styles.wayBack} onClick={goBack} data-testid={timerControlsSheetTestIds.wayBack}>
      <span className={styles.words}>
        <span className={styles.label}>{wayBack === "step" ? `Back to step ${timer.step + 1}` : "Open the recipe’s cooking mode"}</span>
        <span className={styles.detail}>{wayBack === "step" ? timer.recipeTitle : "At the start: the method has changed since"}</span>
      </span>
      <StrokeIcon name="arrowRight" size={18} />
    </button>
  );
};

export const TimerControlsSheet = ({ timer: given, onClose, onLeaving }: TimerControlsSheetProps) => {
  const { open, kept: timer } = useKeptWhileClosing(given);
  const timers = useCookingTimers();

  return (
    <CookingTimerSheet
      timer={timer}
      open={open}
      now={timers.now}
      onPause={timers.pause}
      onResume={timers.resume}
      onAdjust={timers.adjust}
      onCancel={(id) => {
        timers.cancel(id);
        onClose();
      }}
      onClose={onClose}
      recipeTitle={timer?.recipeTitle ?? null}
      wayBack={timer === null ? null : <TimerWayBack timer={timer} onLeaving={onLeaving} onClose={onClose} />}
    />
  );
};
