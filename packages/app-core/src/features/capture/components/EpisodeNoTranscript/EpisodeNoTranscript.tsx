import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./EpisodeNoTranscript.module.scss";
import { episodeNoTranscriptTestIds } from "./EpisodeNoTranscriptTestIds.js";

// Design 106j: beside the episode's tab, 106h's words, shorter, in place of Create overview.
// There is no link to try instead, since the tab is the link.
export function EpisodeNoTranscript() {
  return (
    <>
      <div className={styles.card} role="alert" data-testid={episodeNoTranscriptTestIds.root}>
        <p className={styles.heading}>No transcript for this one yet</p>
        <p className={styles.body}>
          An overview is written from the words, and we couldn’t find them for this episode. No overview was used.
        </p>
      </div>
      <p className={styles.comingSoon}>
        <StrokeIcon name="mic" size={14} />
        Transcribing is coming soon
      </p>
    </>
  );
}
