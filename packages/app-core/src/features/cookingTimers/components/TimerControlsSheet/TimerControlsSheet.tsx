import { recipeActions, type OverviewId } from "@overview/domain";
import { useNavigate } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useQuery } from "@tanstack/react-query";
import { overviewWithStateQueryOptions } from "../../../overviews/queries/overviewWithStateQuery.js";
import { useStores } from "../../../../stores/StoresContext.js";
import { CookingTimerSheet } from "../../../reader/components/CookingTimerSheet/CookingTimerSheet.js";
import type { CookingTimer } from "../../../reader/util/cookingTimers.js";
import { useCookingTimers } from "../../CookingTimersContext.js";
import styles from "./TimerControlsSheet.module.scss";
import { timerControlsSheetTestIds } from "./TimerControlsSheetTestIds.js";

export interface TimerControlsSheetProps {
  timer: CookingTimer | null;
  onClose: () => void;
  // Run before going back to another recipe, as when cooking one recipe and opening another's
  // timer (design 288e).
  onLeaving?: () => void;
}

type WayBack = "step" | "start" | "gone" | "unknown";

// A timer's controls outside its recipe's cooking mode (designs 288s–288v): OV-284's sheet with
// the recipe named, and a way back to the action it came from. The app looks the recipe up, since
// it may have changed or gone since, and looks afresh each time; a shared page's one copy can do
// neither.
function useWayBack(timer: CookingTimer | null): WayBack {
  const { scope } = useCookingTimers();
  const { overviewStore } = useStores();
  const query = useQuery({
    ...overviewWithStateQueryOptions(overviewStore, (timer?.source.recipe ?? "") as OverviewId),
    enabled: timer !== null && scope === "reader",
    refetchOnMount: "always",
  });
  if (timer === null) return "unknown";
  if (scope === "sharedPage") return "step";
  if (query.isPending || query.isFetching) return "unknown";
  const recipe = query.data?.overview.recipe ?? null;
  if (recipe === null) return "gone";
  return recipeActions(recipe.steps)[timer.source.action]?.text === timer.actionText ? "step" : "start";
}

export function TimerControlsSheet({ timer, onClose, onLeaving }: TimerControlsSheetProps) {
  const timers = useCookingTimers();
  const navigate = useNavigate();
  const wayBack = useWayBack(timer);

  const goBack = (landed: "step" | "start") => {
    if (timer === null) return;
    timers.eventsFor(timer).backToStep({ landed });
    onLeaving?.();
    onClose();
    timers.requestCook({ recipe: timer.source.recipe, action: timer.source.action, actionText: timer.actionText });
    if (timers.scope === "reader") void navigate(Routes.overview(timer.source.recipe as OverviewId));
  };

  const back =
    timer === null || wayBack === "unknown" ? null : wayBack === "gone" ? (
      <p className={styles.gone} data-testid={timerControlsSheetTestIds.gone}>
        This note was deleted, so there’s no step to go back to. The timer carries on.
      </p>
    ) : (
      <button type="button" className={styles.wayBack} onClick={() => goBack(wayBack)} data-testid={timerControlsSheetTestIds.wayBack}>
        <span className={styles.words}>
          <span className={styles.label}>{wayBack === "step" ? `Back to step ${timer.step + 1}` : "Open the recipe’s cooking mode"}</span>
          <span className={styles.detail}>{wayBack === "step" ? timer.recipeTitle : "At the start: the method has changed since"}</span>
        </span>
        <StrokeIcon name="arrowRight" size={18} />
      </button>
    );

  return (
    <CookingTimerSheet
      timer={timer}
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
      wayBack={back}
    />
  );
}
