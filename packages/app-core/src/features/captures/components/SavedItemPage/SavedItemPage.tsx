import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PLAN, formatClock, sourceName, type SavedCapture } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useStores } from "../../../../stores/StoresContext.js";
import { shouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import { useNewOverviewRunController } from "../../../newOverview/NewOverviewRunContext.js";
import { useOverviewUsageQuery } from "../../../newOverview/queries/overviewUsageQuery.js";
import { useNextQuota } from "../../../newOverview/useNextQuota.js";
import { resetDate } from "../../../newOverview/util/usageLine.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { TranscriptPanel } from "../../../reader/components/TranscriptPanel/TranscriptPanel.js";
import { timedSource } from "../../../reader/util/timedSource.js";
import { captureKeys } from "../../captureKeys.js";
import styles from "./SavedItemPage.module.scss";
import { savedItemPageTestIds } from "./SavedItemPageTestIds.js";

const SAVED_ON = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const openLabelOf = (capture: SavedCapture): string => {
  switch (capture.source.kind) {
    case "youtube":
      return "Watch on YouTube";
    case "web":
      return "Open the article";
    case "podcast":
      return "Play the episode";
    default:
      return `Open it on ${sourceName(capture.source)}`;
  }
};

const lengthOf = (capture: SavedCapture): string | null =>
  "durationMs" in capture.source && capture.source.durationMs != null ? formatClock(Math.round(capture.source.durationMs / 1000)) : null;

export interface SavedItemPageProps {
  capture: SavedCapture;
}

// Design 358l: left out, not greyed out, until its overview exists (docs/features/kept-links.md, "Opening one").
export const SavedItemPage = ({ capture }: SavedItemPageProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { captureStore } = useStores();
  const { start, openWith } = useNewOverviewRunController();
  const next = useNextQuota();
  const usage = useOverviewUsageQuery().data;
  const [plansOpen, setPlansOpen] = useState(false);
  const video = timedSource(capture.source);
  const canMake = next?.kind === "quota";
  const facts = [sourceName(capture.source), lengthOf(capture)].filter((fact): fact is string => fact !== null);

  const make = () => {
    if (capture.source.kind === "youtube") {
      start(capture.url, { from: "regenerate", overviewId: capture.id });
      void navigate(Routes.home(), { viewTransition: shouldAnimateNavigation() });
      return;
    }
    openWith(capture.url);
  };

  const remove = async () => {
    await captureStore.removeCapture(capture.id);
    await queryClient.invalidateQueries({ queryKey: captureKeys.all });
    void navigate(Routes.home(), { viewTransition: shouldAnimateNavigation() });
  };

  return (
    <article className={styles.root} data-testid={savedItemPageTestIds.root}>
      <PageLink className={styles.back} to={Routes.home()}>
        ← Library
      </PageLink>
      <OverviewThumbnail video={capture.source} className={styles.thumbnail} />
      <p className={styles.facts}>{facts.join(" · ")}</p>
      <h1 className={styles.title} data-testid={savedItemPageTestIds.title}>
        {capture.source.title}
      </h1>
      <p className={styles.saved}>
        <StrokeIcon name="bookmark" size={12} />
        Saved {SAVED_ON.format(new Date(capture.savedAt))} · no overview yet
      </p>
      <div className={styles.actions}>
        <a className={styles.action} href={capture.url} target="_blank" rel="noreferrer">
          {openLabelOf(capture)}
        </a>
        <button type="button" className={styles.action} onClick={() => void remove()} data-testid={savedItemPageTestIds.remove}>
          Remove
        </button>
      </div>
      <div className={styles.card} data-testid={savedItemPageTestIds.noOverview}>
        {canMake ? (
          <>
            <span className={styles.cardText}>
              <b className={styles.cardTitle}>Make its overview now.</b>
              <span className={styles.cardBody}>
                Your {next.limit} are back. It uses one{video === null ? "" : ", and reads the transcript you already have"}.
              </span>
            </span>
            <button type="button" className={styles.primary} onClick={make} data-testid={savedItemPageTestIds.makeOverview}>
              Make overview
            </button>
          </>
        ) : (
          <>
            <span className={styles.cardText}>
              <b className={styles.cardTitle}>No overview yet.</b>
              <span className={styles.cardBody}>
                Make it, with its chapters and questions, once your overviews are back
                {usage === undefined ? "" : ` on ${resetDate(usage.resetsOn)}`}; you can ask about it then.
                {video === null ? "" : " Until then the transcript is here to read and search."}
              </span>
            </span>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setPlansOpen(true)}
              data-testid={savedItemPageTestIds.getPlus}
            >
              Get Plus
            </button>
          </>
        )}
      </div>
      <p className={styles.comes}>Its overview brings a read and a listen, its topics and verdict, chapters, questions and chat.</p>
      {video !== null && (
        <section className={styles.transcript} aria-label="Transcript" data-testid={savedItemPageTestIds.transcript}>
          <h2 className={styles.tab}>Transcript</h2>
          <TranscriptPanel video={video} openAtMs={null} openedFrom={null} onBackToChapters={() => undefined} />
        </section>
      )}
      <PlansModal open={plansOpen} plan={usage?.plan ?? DEFAULT_PLAN} onClose={() => setPlansOpen(false)} />
    </article>
  );
};
