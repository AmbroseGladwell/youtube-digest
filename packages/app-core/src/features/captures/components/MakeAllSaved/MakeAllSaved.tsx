import type { SavedCapture } from "@overview/domain";
import { useNewOverviewRunController } from "../../../newOverview/NewOverviewRunContext.js";
import { useNextQuota } from "../../../newOverview/useNextQuota.js";
import styles from "./MakeAllSaved.module.scss";
import { makeAllSavedTestIds } from "./MakeAllSavedTestIds.js";

export interface MakeAllSavedProps {
  saved: readonly SavedCapture[];
}

// Nothing is made on its own at the reset; the reader chooses, one or all (docs/features/kept-links.md).
export const MakeAllSaved = ({ saved }: MakeAllSavedProps) => {
  const { makeAllSaved } = useNewOverviewRunController();
  const next = useNextQuota();
  const makeable = saved.filter((capture) => capture.source.kind !== "web");
  if (next?.kind !== "quota" || makeable.length === 0) {
    return null;
  }
  const chosen = makeable.slice(0, next.left);
  return (
    <div className={styles.root} data-testid={makeAllSavedTestIds.root}>
      <button type="button" className={styles.button} onClick={() => makeAllSaved(chosen)} data-testid={makeAllSavedTestIds.button}>
        {chosen.length === makeable.length ? `Make all ${chosen.length}` : `Make ${chosen.length}`}
      </button>
      <span className={styles.uses}>
        uses {chosen.length} of your {next.left}
      </span>
    </div>
  );
};
