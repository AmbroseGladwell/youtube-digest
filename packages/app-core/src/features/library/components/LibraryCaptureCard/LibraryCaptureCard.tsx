import { sourceName, type SavedCapture } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { LibraryViewState } from "../../util/libraryViewState.js";
import { SaidMomentLink, type SaidMoment } from "../SaidMomentLink/SaidMomentLink.js";
import styles from "./LibraryCaptureCard.module.scss";
import { libraryCaptureCardTestIds } from "./LibraryCaptureCardTestIds.js";

export interface LibraryCaptureCardProps {
  capture: SavedCapture;
  entering?: boolean;
  onOpen: () => void;
  readerState: LibraryViewState;
  said?: SaidMoment | null;
}

// Design 358h-5: an ordinary row, without the topics, verdict and times only its overview brings.
export const LibraryCaptureCard = ({ capture, entering = false, onOpen, readerState, said = null }: LibraryCaptureCardProps) => {
  const path = Routes.overview(capture.id);
  const hasTranscript = capture.source.kind !== "web";
  return (
    <article
      className={`${styles.root} ${entering ? styles.entering : ""}`}
      data-entering={entering || undefined}
      data-testid={libraryCaptureCardTestIds.root}
    >
      <OverviewThumbnail video={capture.source} to={path} state={readerState} onOpen={onOpen} className={styles.thumbnail} />
      <div className={styles.body}>
        <p className={styles.kicker}>{sourceName(capture.source)}</p>
        <PageLink
          className={styles.titleLink}
          to={path}
          state={readerState}
          onClick={onOpen}
          data-testid={libraryCaptureCardTestIds.titleLink}
        >
          <span className={styles.title}>{capture.source.title}</span>
        </PageLink>
        <p className={styles.status} data-testid={libraryCaptureCardTestIds.status}>
          <StrokeIcon name="bookmark" size={12} />
          {hasTranscript ? "No overview yet · Transcript ready" : "No overview yet"}
        </p>
        {said !== null && (
          <SaidMomentLink said={said} to={path} readerState={readerState} onClick={onOpen} testId={libraryCaptureCardTestIds.saidLink} />
        )}
      </div>
    </article>
  );
};
