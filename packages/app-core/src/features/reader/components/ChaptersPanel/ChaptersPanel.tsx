import styles from "./ChaptersPanel.module.scss";
import { chaptersPanelTestIds } from "./ChaptersPanelTestIds.js";
import { PLACEHOLDER_CHAPTERS } from "./placeholderChapters.js";

export function ChaptersPanel() {
  return (
    <div className={styles.root} data-testid={chaptersPanelTestIds.root}>
      <p className={styles.head}>
        <span>{PLACEHOLDER_CHAPTERS.length} chapters</span>
        <span className={styles.placeholderNote} data-testid={chaptersPanelTestIds.placeholderNote}>
          Placeholder — chapters aren't generated yet
        </span>
      </p>
      {PLACEHOLDER_CHAPTERS.map((chapter) => (
        <div key={chapter.range} className={styles.row} data-testid={chaptersPanelTestIds.row}>
          <span className={styles.range}>{chapter.range}</span>
          <span className={styles.title}>{chapter.title}</span>
          <span className={styles.summary}>{chapter.summary}</span>
        </div>
      ))}
    </div>
  );
}
