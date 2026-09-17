import { Link } from "react-router";
import type { Overview } from "@overview/types";
import { Routes } from "../../../../app/Routes.js";
import { useShouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { PlayPauseIcon } from "../../../../components/shared/PlayPauseIcon/PlayPauseIcon.js";
import { NOVELTY_LABEL } from "../../../overviews/noveltyLabel.js";
import type { OverviewNeighbours } from "../../util/overviewNeighbours.js";
import styles from "./ReaderMasthead.module.scss";
import { readerMastheadTestIds } from "./ReaderMastheadTestIds.js";

export interface ReaderMastheadProps {
  overview: Overview;
  topicNames: string[];
  metaParts: string[];
  neighbours: OverviewNeighbours;
  read: boolean;
  playing: boolean;
  onToggleRead: () => void;
  onTogglePlaying: () => void;
}

const savedOn = (savedAt: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

export function ReaderMasthead({
  overview,
  topicNames,
  metaParts,
  neighbours,
  read,
  playing,
  onToggleRead,
  onTogglePlaying,
}: ReaderMastheadProps) {
  const animateNavigation = useShouldAnimateNavigation();

  return (
    <header className={styles.root} data-testid={readerMastheadTestIds.root}>
      <nav className={styles.topBar} aria-label="Overview navigation">
        <Link
          className={styles.backLink}
          to={Routes.home()}
          viewTransition={animateNavigation}
          data-testid={readerMastheadTestIds.backLink}
        >
          ← All overviews
        </Link>
        <span className={styles.breadcrumb} data-testid={readerMastheadTestIds.breadcrumb}>
          Overviews {topicNames[0] ? `/ ${topicNames[0]} ` : ""}/{" "}
          <span className={styles.breadcrumbLeaf}>{overview.video.title}</span>
        </span>
        <span className={styles.stepper}>
          {neighbours.previousId && (
            <Link
              className={styles.stepLink}
              to={Routes.overview(neighbours.previousId)}
              viewTransition={animateNavigation}
              data-testid={readerMastheadTestIds.previousLink}
            >
              ↑ Previous
            </Link>
          )}
          {neighbours.nextId && (
            <Link
              className={styles.stepLink}
              to={Routes.overview(neighbours.nextId)}
              viewTransition={animateNavigation}
              data-testid={readerMastheadTestIds.nextLink}
            >
              Next ↓
            </Link>
          )}
          {neighbours.position !== null && (
            <span className={styles.position} data-testid={readerMastheadTestIds.position}>
              {neighbours.position} of {neighbours.total}
            </span>
          )}
        </span>
      </nav>

      <div className={styles.titleRow}>
        <OverviewThumbnail video={overview.video} className={styles.thumbnail} />

        <div className={styles.titleBlock}>
          <p className={styles.kickerRow}>
            {topicNames.map((name) => (
              <span key={name} className={styles.topicPill}>
                {name}
              </span>
            ))}
            <span className={styles.byline}>
              {overview.video.channel} · saved {savedOn(overview.savedAt)}
              {overview.verdict && (
                <>
                  {" · "}
                  <span
                    className={overview.verdict.novelty === "novel" ? styles.verdictNovel : styles.verdict}
                  >
                    {NOVELTY_LABEL[overview.verdict.novelty]}
                  </span>
                </>
              )}
              {overview.thin && <span className={styles.verdict}> · Thin · no clear claim</span>}
            </span>
            {overview.verdict?.dubious && <span className={styles.dubious}>⚠ Dubious claim</span>}
          </p>

          <h2 className={styles.title} data-testid={readerMastheadTestIds.title}>
            {overview.video.title}
          </h2>

          <p className={styles.meta} data-testid={readerMastheadTestIds.meta}>
            {metaParts.join(" · ")}
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.action} ${read ? styles.actionActive : ""}`}
            onClick={onToggleRead}
            aria-pressed={read}
            data-testid={readerMastheadTestIds.readButton}
          >
            {read ? "Read" : "Mark read"}
          </button>
          <button
            type="button"
            className={styles.readAloud}
            onClick={onTogglePlaying}
            aria-pressed={playing}
            data-testid={readerMastheadTestIds.readAloudButton}
          >
            <PlayPauseIcon playing={playing} /> Read aloud
          </button>
        </div>
      </div>
    </header>
  );
}
