import type { Ref } from "react";
import { Link } from "react-router";
import type { Overview } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { useShouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { PlayPauseIcon } from "../../../../components/shared/PlayPauseIcon/PlayPauseIcon.js";
import { NOVELTY_LABEL } from "../../../overviews/noveltyLabel.js";
import { OverviewActionsMenu } from "../OverviewActionsMenu/OverviewActionsMenu.js";
import { TopicLine } from "../TopicLine/TopicLine.js";
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
  editingTopics: boolean;
  // Design 15c: the side panel's head is the title, the topics, the meta line and one
  // Listen — no breadcrumb, no stepper, no thumbnail, because there is no list behind it
  // to have come from (docs/features/extension-panel.md).
  compact: boolean;
  listening: boolean;
  onToggleRead: () => void;
  onTogglePlaying: () => void;
  onListen: () => void;
  onEditingTopicsChange: (editing: boolean) => void;
  onEditReason: () => void;
  ref?: Ref<HTMLElement> | undefined;
}

// Boolean(...), not !== null: an overview saved before publishedAt existed has no such
// key at all (see OverviewThumbnail, and v1-architecture-decisions.md's swappable-store
// model, which reads back whatever was written).
const savedOn = (savedAt: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

export function ReaderMasthead({
  overview,
  topicNames,
  metaParts,
  neighbours,
  read,
  playing,
  editingTopics,
  compact,
  listening,
  onToggleRead,
  onTogglePlaying,
  onListen,
  onEditingTopicsChange,
  onEditReason,
  ref,
}: ReaderMastheadProps) {
  const animateNavigation = useShouldAnimateNavigation();

  const topicLine = (
    <TopicLine
      overview={overview}
      editing={editingTopics}
      onEditingChange={onEditingTopicsChange}
    />
  );

  return (
    <header
      className={`${styles.root} ${compact ? styles.rootSticky : ""}`}
      ref={ref}
      data-testid={readerMastheadTestIds.root}
    >
      {!compact && (
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
      )}

      <div className={`${styles.titleRow} ${compact ? styles.titleRowCompact : ""}`}>
        {!compact && <OverviewThumbnail video={overview.video} className={styles.thumbnail} />}

        <div className={styles.titleBlock}>
          {/* The panel keeps the judgement and drops the dates: at 400px "published"
              and "saved" are two facts about when, and what the head is for is what the
              note says (docs/features/extension-panel.md). */}
          {!compact && (
            <p className={styles.kickerRow}>
              {topicLine}
              <span className={styles.byline}>
                {overview.video.channel}
                {Boolean(overview.video.publishedAt) && (
                  <span data-testid={readerMastheadTestIds.published}>
                    {" · published "}
                    {formatPublishedDate(overview.video.publishedAt!)}
                  </span>
                )}
                {" · saved "}
                {savedOn(overview.savedAt)}
                {overview.verdict && (
                  <>
                    {" · "}
                    <span
                      className={
                        overview.verdict.novelty === "novel" ? styles.verdictNovel : styles.verdict
                      }
                    >
                      {NOVELTY_LABEL[overview.verdict.novelty]}
                    </span>
                  </>
                )}
                {overview.thin && <span className={styles.verdict}> · Thin · no clear claim</span>}
              </span>
              {overview.verdict?.dubious && <span className={styles.dubious}>⚠ Dubious claim</span>}
            </p>
          )}

          <h2 className={styles.title} data-testid={readerMastheadTestIds.title}>
            {overview.video.title}
          </h2>

          {compact && (
            <>
              <p className={styles.channel} data-testid={readerMastheadTestIds.channel}>
                {overview.video.channel}
              </p>
              {/* One line with the topics: the filing and the verdict read together
                  rather than as two bands of small caps. */}
              <p className={styles.kickerRow}>
                {topicLine}
                {overview.verdict && (
                  <span
                    className={
                      overview.verdict.novelty === "novel" ? styles.verdictNovel : styles.verdict
                    }
                  >
                    {NOVELTY_LABEL[overview.verdict.novelty]}
                  </span>
                )}
                {overview.thin && <span className={styles.verdict}>Thin · no clear claim</span>}
                {overview.verdict?.dubious && (
                  <span className={styles.dubious}>⚠ Dubious claim</span>
                )}
              </p>
            </>
          )}

          <p className={styles.meta} data-testid={readerMastheadTestIds.meta}>
            {metaParts.join(" · ")}
          </p>
        </div>

        <div className={styles.actions}>
          {compact ? (
            <button
              type="button"
              className={`${styles.listen} ${listening ? styles.listenActive : ""}`}
              onClick={onListen}
              aria-pressed={listening}
              data-testid={readerMastheadTestIds.listenButton}
            >
              {listening ? "Listening" : "Listen"}
            </button>
          ) : (
            <>
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
            </>
          )}
          <OverviewActionsMenu
            topicCount={overview.topicIds.length}
            hasReason={overview.captureReason !== null}
            align={compact ? "start" : "end"}
            onEditTopics={() => onEditingTopicsChange(true)}
            onEditReason={onEditReason}
          />
        </div>
      </div>
    </header>
  );
}
