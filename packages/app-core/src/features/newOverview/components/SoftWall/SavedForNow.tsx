import { useEffect, useRef } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./SoftWall.module.scss";
import { softWallTestIds } from "./SoftWallTestIds.js";

export interface SavedForNowProps {
  title: string;
  kicker: string | null;
  resetsOn: string;
  overviewsBack: string;
  hasTranscript: boolean;
  onDone: () => void;
  onReadTranscript: () => void;
}

// Design 358f-2: the link is a real item in the library, its overview made when the reader chooses.
export const SavedForNow = ({ title, kicker, resetsOn, overviewsBack, hasTranscript, onDone, onReadTranscript }: SavedForNowProps) => {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className={styles.root} aria-labelledby="saved-for-now-heading" data-testid={softWallTestIds.saved}>
      <h2 id="saved-for-now-heading" ref={heading} tabIndex={-1} className={styles.title}>
        {hasTranscript ? "Saved, with its transcript." : "Saved."}
      </h2>
      <p className={styles.lead}>
        It’s in your library{hasTranscript ? " to read and search" : ""}. Make its overview, chapters and questions whenever you like once
        your {overviewsBack} are back on {resetsOn}.
      </p>
      <div className={styles.card}>
        <span className={styles.label}>In your library</span>
        {kicker !== null && <span className={styles.kicker}>{kicker}</span>}
        <span className={styles.linkTitle}>{title}</span>
        <span className={styles.chip}>
          <StrokeIcon name="bookmark" size={12} />
          Saved · no overview yet
        </span>
      </div>
      <div className={styles.savedActions}>
        <button type="button" className={styles.primary} onClick={onDone} data-testid={softWallTestIds.savedDone}>
          Done
        </button>
        <button type="button" className={styles.link} onClick={onReadTranscript} data-testid={softWallTestIds.readTranscript}>
          {hasTranscript ? "Read the transcript" : "Open it"}
        </button>
      </div>
    </section>
  );
};
