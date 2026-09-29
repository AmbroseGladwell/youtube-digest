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
const LOOKING_FOR_TRANSCRIPT = "Looking for this note's transcript";
const NO_TRANSCRIPT = "No transcript was kept for this note";
const COULD_NOT_LOAD_TRANSCRIPT = "Couldn't load this note's transcript";

export interface ChaptersPanelProps {
  chapters: Chapter[] | null;
  video: VideoSource;
  onOpenTranscriptAt: (positionMs: number) => void;
}

const chapterNumber = (index: number) => String(index + 1).padStart(2, "0");

// How far through the current chapter the player is, from the player's own position and
// the chapter's own bounds — a measurement, not an estimate (docs/prototype/constraints.md).
const throughChapter = (chapter: Chapter, positionMs: number): number => {
  const length = chapter.endMs - chapter.startMs;
  if (length <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(((positionMs - chapter.startMs) / length) * 100)));
};

// Design 3a: the chapter the video is inside sits on the raised card with an orange
// range and a thin bar through it; the chapters before it drop to the muted ink.
export function ChaptersPanel({ chapters, video, onOpenTranscriptAt }: ChaptersPanelProps) {
  const isPanel = useIsPanel();
  const seek = useSeekPlayback(video.id);
  const position = usePlaybackPosition(video.id);
  const transcriptQuery = useTranscriptQuery(video.id);
  const hasTranscript = (transcriptQuery.data?.segments.length ?? 0) > 0;
  const noTranscriptReason = transcriptQuery.isError
    ? COULD_NOT_LOAD_TRANSCRIPT
    : transcriptQuery.fetchStatus === "fetching"
      ? LOOKING_FOR_TRANSCRIPT
      : NO_TRANSCRIPT;

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
        {position !== null ? (
          <span className={styles.following} data-testid={chaptersPanelTestIds.followingNote}>
            <span className={styles.followingMark} aria-hidden="true" />
            Following the video
          </span>
        ) : (
          <span className={styles.label} data-testid={chaptersPanelTestIds.count}>
            {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
          </span>
        )}
      </p>
      <div className={styles.rows}>
        {chapters.map((chapter, index) => {
          const current = index === currentIndex;
          const past = currentIndex !== -1 && index < currentIndex;
          return (
            <div
              key={chapter.startMs}
              className={`${styles.row} ${current ? styles.rowCurrent : ""} ${past ? styles.rowPast : ""}`}
              data-current={current}
              data-testid={chaptersPanelTestIds.row}
            >
              <span className={styles.meta}>
                <span className={styles.range}>
                  <span className={styles.number} aria-hidden="true">
                    {chapterNumber(index)} ·{" "}
                  </span>
                  <ChapterRange chapter={chapter} video={video} seek={seek} linksOut={!isPanel} />
                </span>
                <span className={styles.metaEnd}>
                  {current && (
                    <span className={styles.playingBadge} data-testid={chaptersPanelTestIds.playingBadge}>
                      <span className={styles.playingMark} aria-hidden="true" />
                      Playing on YouTube
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.transcriptButton}
                    onClick={() => onOpenTranscriptAt(chapter.startMs)}
                    disabled={!hasTranscript}
                    title={hasTranscript ? undefined : noTranscriptReason}
                    aria-label={`Open the transcript at ${formatTimestamp(chapter.startMs)}`}
                    data-testid={chaptersPanelTestIds.transcriptButton}
                  >
                    Transcript
                  </button>
                </span>
              </span>
              <span className={styles.title} data-testid={chaptersPanelTestIds.title}>
                {chapter.title}
              </span>
              <span className={styles.summary} data-testid={chaptersPanelTestIds.summary}>
                {chapter.summary}
              </span>
              {current && position !== null && (
                <span
                  className={styles.progress}
                  role="progressbar"
                  aria-label="Through this chapter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={throughChapter(chapter, position.positionMs)}
                  data-testid={chaptersPanelTestIds.progress}
                >
                  <span
                    className={styles.progressFill}
                    style={{ width: `${throughChapter(chapter, position.positionMs)}%` }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
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
// is moved, the wide reader links out to YouTube, and a panel whose tab has moved on
// prints the range as plain text (docs/features/chapters.md).
function ChapterRange({ chapter, video, seek, linksOut }: ChapterRangeProps) {
  const label = formatTimeRange(chapter.startMs, chapter.endMs);

  if (seek !== null) {
    return (
      <button
        type="button"
        className={styles.rangeControl}
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
        className={styles.rangeControl}
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
  return <span data-testid={chaptersPanelTestIds.range}>{label}</span>;
}
