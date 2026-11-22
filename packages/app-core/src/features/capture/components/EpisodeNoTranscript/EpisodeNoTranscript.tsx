import styles from "./EpisodeNoTranscript.module.scss";
import { episodeNoTranscriptTestIds } from "./EpisodeNoTranscriptTestIds.js";

// No link to try instead, since the tab is the link (design 106j).
export const EpisodeNoTranscript = () => {
  return (
    <div className={styles.card} role="alert" data-testid={episodeNoTranscriptTestIds.root}>
      <p className={styles.heading}>No transcript for this one yet</p>
      <p className={styles.body}>
        An overview is written from the words, and we couldn’t find them for this episode. No overview was used.
      </p>
    </div>
  );
};
