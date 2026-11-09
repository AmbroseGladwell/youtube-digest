import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useStartArticleRun } from "../../../newOverview/useStartArticleRun.js";
import { shouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import type { OnThisTab } from "../../useOnThisTab.js";
import styles from "./OnThisTabLine.module.scss";
import { onThisTabLineTestIds } from "./OnThisTabLineTestIds.js";

export interface OnThisTabLineProps {
  tab: OnThisTab;
  onStartVideo: (url: string) => void;
}

// Design 205e: with a note open and the tab moved on, one 36px line in the band under the
// bar. The copy is generic and never names what's on the tab: the reader can see the tab
// beside the panel. Making lands on home, where the run is the page, exactly as if the
// offer had been taken there (docs/features/extension-panel.md).
export function OnThisTabLine({ tab, onStartVideo }: OnThisTabLineProps) {
  const analytics = useAnalytics();
  const navigate = useNavigate();
  const startArticleRun = useStartArticleRun();
  const offer = tab.held === null ? "make" : "read";

  const announced = useRef<string | null>(null);
  const subject = tab.videoUrl ?? tab.page?.url ?? "";
  useEffect(() => {
    if (announced.current === `${subject}:${offer}`) return;
    announced.current = `${subject}:${offer}`;
    analytics.capture.onThisTab.shown({ offer });
  }, [analytics, subject, offer]);

  const take = () => {
    analytics.capture.onThisTab.followed({ offer });
    if (tab.held !== null) {
      void navigate(Routes.overview(tab.held.id), { viewTransition: shouldAnimateNavigation() });
      return;
    }
    // Chrome refuses a grant asked for outside the click, so the article run starts here
    // and home renders the progress the shell is already tracking.
    if (tab.page !== null) startArticleRun(tab.page, { from: "panel", willAsk: true });
    else if (tab.videoUrl !== null) onStartVideo(tab.videoUrl);
    void navigate(Routes.home(), { viewTransition: shouldAnimateNavigation() });
  };

  return (
    <div className={styles.root} role="region" aria-label="On this tab" data-testid={onThisTabLineTestIds.root}>
      <span className={styles.icon} aria-hidden="true">
        <StrokeIcon name={tab.kind === "video" ? "video" : "scrollText"} size={14} />
      </span>
      <span className={styles.message} data-testid={onThisTabLineTestIds.message}>
        Another {tab.kind} on this tab
      </span>
      <button type="button" className={styles.offer} onClick={take} data-testid={onThisTabLineTestIds.offer}>
        {offer === "read" ? "Read overview" : "Make an overview"}
        <StrokeIcon name="chevronRight" size={14} />
      </button>
      <button
        type="button"
        className={styles.dismiss}
        aria-label={`Dismiss: another ${tab.kind} on this tab`}
        onClick={() => {
          analytics.capture.onThisTab.dismissed({ offer });
          tab.dismiss();
        }}
        data-testid={onThisTabLineTestIds.dismissButton}
      >
        <StrokeIcon name="close" size={14} />
      </button>
    </div>
  );
}
