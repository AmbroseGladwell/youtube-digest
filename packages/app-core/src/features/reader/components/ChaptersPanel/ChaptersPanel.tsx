import type { Chapter, VideoSource } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { usePlaybackPosition, useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { useTranscriptQuery } from "../../../transcripts/queries/transcriptQuery.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";
import { formatTimeRange } from "../../../overviews/util/formatTimeRange.js";
import { youtubeTimestampUrl } from "../../../overviews/util/youtubeTimestampUrl.js";
import { formatTimestamp } from "../../../../util/formatTimestamp.js";
import styles from "./ChaptersPanel.module.scss";
import { chaptersPanelTestIds } from "./ChaptersPanelTestIds.js";

const NOT_MADE = "Chapters weren't made for this note. Generating it again adds them.";
const NOTHING_TO_SPLIT = "This video's transcript had nothing to split into chapters.";

export interface ChaptersPanelProps {
  chapters: Chapter[] | null;
  video: VideoSource;
  onOpenTranscriptAt: (positionMs: number) => void;
}

export function ChaptersPanel({ chapters, video, onOpenTranscriptAt }: ChaptersPanelProps) {
  const isPanel = useIsPanel();
  const seek = useSeekPlayback(video.id);
  const position = usePlaybackPosition(video.id);
  const transcriptQuery = useTranscriptQuery(video.id);
  const hasTranscript = (transcriptQuery.data?.segments.length ?? 0) > 0;

  const currentIndex =
    chapters === null || position === null ? -1 : blockAtPosition(chapters, position.positionMs);

  if (chapters === null || chapters.length === 0) {
    return (
      <div className={styles.root} data-testid={chaptersPanelTestIds.root}>
        <p className={styles.note} data-testid={chaptersPanelTestIds.note}>
          {chapters === null ? NOT_MADE : NOTHING_TO_SPLIT}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid={chaptersPanelTestIds.root}>
      <p className={styles.head}>
        <span data-testid={chaptersPanelTestIds.count}>
          {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
        </span>
      </p>
      {chapters.map((chapter, index) => {
        const current = index === currentIndex;
        return (
          <div
            key={chapter.startMs}
            className={`${styles.row} ${current ? styles.rowCurrent : ""}`}
            data-current={current}
            data-testid={chaptersPanelTestIds.row}
          >
            <span className={styles.meta}>
              <ChapterRange chapter={chapter} video={video} seek={seek} linksOut={!isPanel} />
              {hasTranscript && (
                <button
                  type="button"
                  className={styles.transcriptButton}
                  onClick={() => onOpenTranscriptAt(chapter.startMs)}
                  aria-label={`Open the transcript at ${formatTimestamp(chapter.startMs)}`}
                  data-testid={chaptersPanelTestIds.transcriptButton}
                >
                  Transcript
                </button>
              )}
            </span>
            <span className={styles.title} data-testid={chaptersPanelTestIds.title}>
              {chapter.title}
            </span>
            <span className={styles.summary} data-testid={chaptersPanelTestIds.summary}>
              {chapter.summary}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ChapterRangeProps {
  chapter: Chapter;
  video: VideoSource;
  seek: ((positionMs: number) => void) | null;
  linksOut: boolean;
}

// The range is the control, as the transcript's times are: a player beside the panel
// is moved, the wide reader links out to YouTube the way its rail does, and a panel
// whose tab has moved on prints the range as plain text (docs/features/chapters.md).
function ChapterRange({ chapter, video, seek, linksOut }: ChapterRangeProps) {
  const label = formatTimeRange(chapter.startMs, chapter.endMs);

  if (seek !== null) {
    return (
      <button
        type="button"
        className={`${styles.range} ${styles.rangeControl}`}
        onClick={() => seek(chapter.startMs)}
        aria-label={`Play the video from ${formatTimestamp(chapter.startMs)}`}
        data-testid={chaptersPanelTestIds.range}
      >
        {label}
      </button>
    );
  }
  if (linksOut) {
    return (
      <a
        className={`${styles.range} ${styles.rangeControl}`}
        href={youtubeTimestampUrl(video.url, chapter.startMs)}
        target="_blank"
        rel="noopener"
        aria-label={`Open the video on YouTube at ${formatTimestamp(chapter.startMs)}`}
        data-testid={chaptersPanelTestIds.range}
      >
        {label}
      </a>
    );
  }
  return (
    <span className={styles.range} data-testid={chaptersPanelTestIds.range}>
      {label}
    </span>
  );
}
