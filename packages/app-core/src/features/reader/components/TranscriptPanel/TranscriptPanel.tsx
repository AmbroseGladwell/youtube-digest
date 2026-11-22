import { transcriptBlocks, transcriptPlainText, formatTimestamp } from "@overview/domain";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { StoredTranscript, VideoSource, TranscriptBlock } from "@overview/domain";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { useTranscriptQuery } from "../../../transcripts/queries/transcriptQuery.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";
import { chapterBlockRun, type ChapterBlockRun } from "../../../transcripts/util/chapterBlockRun.js";
import { blockParts } from "../../../transcripts/util/blockParts.js";
import { transcriptFileName } from "../../../transcripts/util/transcriptFileName.js";
import { ClearFieldButton } from "../../../../components/shared/ClearFieldButton/ClearFieldButton.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";
import { useFollowPlayback, type FollowPlayback } from "./useFollowPlayback.js";
import { useReadingPosition, type ReadingPosition } from "./useReadingPosition.js";
import { useTranscriptSearch, type TranscriptSearch } from "./useTranscriptSearch.js";
import { scrollToRestingLine } from "./scrollToRestingLine.js";
import styles from "./TranscriptPanel.module.scss";
import { transcriptPanelTestIds } from "./TranscriptPanelTestIds.js";
import { machineTranscribedLabel, playingLabel, timedNoun } from "../../util/timedSource.js";

const SKELETON_ROWS = 4;
const COPIED_MS = 2000;
const NOTHING_STORED = "No transcript was stored for this note. Generating it again keeps one.";

export interface OpenedFromChapter {
  number: number;
  title: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptPanelProps {
  video: VideoSource;
  // The shared page's own copy; absent, the panel reads the reader's own store.
  held?: StoredTranscript | null;
  openAtMs: number | null;
  openedFrom: OpenedFromChapter | null;
  openedFromStep?: number | null;
  onBackToChapters: () => void;
}

const canCopy = (): boolean => typeof navigator.clipboard?.writeText === "function";

export const TranscriptPanel = ({ video, held, openAtMs, openedFrom, openedFromStep = null, onBackToChapters }: TranscriptPanelProps) => {
  const transcriptQuery = useTranscriptQuery(held === undefined ? video.id : null);
  const transcript = held ?? transcriptQuery.data ?? null;
  const blocks = useMemo(() => (transcript === null ? [] : transcriptBlocks(transcript.segments)), [transcript]);

  // State, not a ref: every scroll below is measured off it and has to run again once it's there.
  const [head, setHead] = useState<HTMLDivElement | null>(null);
  const search = useTranscriptSearch(blocks);
  const targetRun = useMemo((): ChapterBlockRun | null => {
    if (openedFrom !== null) {
      return chapterBlockRun(blocks, openedFrom);
    }
    if (openAtMs === null) {
      return null;
    }
    const at = blockAtPosition(blocks, openAtMs);
    return at === -1 ? null : { from: at, to: at };
  }, [blocks, openedFrom, openAtMs]);
  const targetBlockIndex = targetRun?.from ?? -1;
  const position = useReadingPosition(video.id, blocks, { ignored: openAtMs !== null, head });
  const follow = useFollowPlayback(video.id, blocks, {
    held: position.restoredBlockIndex !== -1,
    head,
  });
  const seek = useSeekPlayback(video.id);
  const [copied, setCopied] = useState(false);
  const analytics = useOverviewPageAnalytics();

  useTypingSettled(search.query, () => analytics.transcript.searched({ matches: search.matches.length }));

  useEffect(() => {
    position.setRemembering(!follow.following);
  }, [position.setRemembering, follow.following]);

  useEffect(() => {
    if (targetBlockIndex !== -1) {
      follow.stop();
    }
  }, [targetBlockIndex]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const plainText = () => transcriptPlainText(video, blocks);

  const copy = () => {
    analytics.transcript.copied();
    void navigator.clipboard.writeText(plainText()).then(() => setCopied(true));
  };

  // An object URL rather than a data: URL, which a long transcript would overrun.
  const exportFile = () => {
    analytics.transcript.exported();
    const href = URL.createObjectURL(new Blob([plainText()], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = transcriptFileName(video);
    link.click();
    URL.revokeObjectURL(href);
  };

  // Why searching stops the follow: docs/features/following-playback.md, "Following, and stopping following".
  const searchFor = (query: string) => {
    search.setQuery(query);
    if (query.trim() !== "") {
      follow.stop();
    }
  };

  const followPlayback = () => {
    analytics.transcript.followResumed();
    search.setQuery("");
    follow.follow();
  };

  const unreadable = unreadableTranscript(video, {
    isPending: held === undefined && transcriptQuery.isPending,
    error: held === undefined && transcriptQuery.isError ? transcriptQuery.error : null,
    blocks,
    retry: () => {
      analytics.transcript.retried();
      void transcriptQuery.refetch();
    },
  });

  const currentBlock = blocks[follow.currentBlockIndex] ?? null;

  const headingLeadFor = (): ReactNode => {
    if (openedFrom !== null) {
      return (
        <button
          type="button"
          className={styles.backToChapters}
          onClick={() => {
            analytics.transcript.backToChapters();
            onBackToChapters();
          }}
          data-testid={transcriptPanelTestIds.backToChaptersButton}
        >
          <StrokeIcon name="arrowLeft" size={14} />
          Back to chapters
        </button>
      );
    }
    if (follow.following) {
      return (
        <span className={styles.following} data-testid={transcriptPanelTestIds.followingNote}>
          <span className={styles.followingMark} aria-hidden="true" />
          Following the {timedNoun(video)}
        </span>
      );
    }
    if (follow.offered) {
      return (
        <span className={styles.notFollowing} data-testid={transcriptPanelTestIds.notFollowingNote}>
          Not following · you scrolled away
        </span>
      );
    }
    return <span className={styles.label}>Full transcript</span>;
  };
  const headingLead = headingLeadFor();

  return (
    <div className={styles.root} data-testid={transcriptPanelTestIds.root}>
      <div className={styles.head} ref={setHead} data-sticky-fade="" data-testid={transcriptPanelTestIds.head}>
        <div className={styles.headingRow}>
          <p className={styles.heading}>
            {headingLead}
            {transcript?.generated === true && (
              <span className={styles.sourceNote} data-testid={transcriptPanelTestIds.sourceNote}>
                {machineTranscribedLabel(timedNoun(video))}
              </span>
            )}
          </p>

          {unreadable === null && (
            <div className={styles.toolRow} data-testid={transcriptPanelTestIds.tools}>
              {canCopy() && (
                <button type="button" className={styles.tool} onClick={copy} data-testid={transcriptPanelTestIds.copyButton}>
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              <button type="button" className={styles.tool} onClick={exportFile} data-testid={transcriptPanelTestIds.exportButton}>
                Export
              </button>
            </div>
          )}
        </div>

        {unreadable === null && <TranscriptSearchBar search={search} onQueryChange={searchFor} />}
      </div>

      {unreadable ?? (
        <TranscriptRows
          noun={timedNoun(video)}
          playing={playingLabel(video)}
          blocks={blocks}
          search={search}
          follow={follow}
          position={position}
          seek={seek}
          targetRun={targetRun}
          openedFrom={openedFrom}
          openedFromStep={openedFromStep}
          head={head}
        />
      )}

      {follow.offered && (
        <button type="button" className={styles.followButton} onClick={followPlayback} data-testid={transcriptPanelTestIds.followButton}>
          <span className={styles.followButtonMark} aria-hidden="true" />
          {currentBlock === null ? `Back to the ${timedNoun(video)}` : `Back to ${formatTimestamp(currentBlock.startMs)}`}
        </button>
      )}
    </div>
  );
};

interface TranscriptState {
  blocks: TranscriptBlock[];
  isPending: boolean;
  error: Error | null;
  retry: () => void;
}

const unreadableTranscript = (video: VideoSource, { blocks, isPending, error, retry }: TranscriptState): ReactNode | null => {
  if (video.id === null) {
    return <TranscriptNote testId={transcriptPanelTestIds.emptyNote}>{NOTHING_STORED}</TranscriptNote>;
  }
  if (error) {
    return (
      <div className={styles.failed}>
        <TranscriptNote testId={transcriptPanelTestIds.errorNote}>Couldn't load this transcript: {error.message}</TranscriptNote>
        <button type="button" className={styles.tool} onClick={retry} data-testid={transcriptPanelTestIds.retryButton}>
          Try again
        </button>
      </div>
    );
  }
  if (isPending) {
    return <TranscriptSkeleton />;
  }
  if (blocks.length === 0) {
    return <TranscriptNote testId={transcriptPanelTestIds.emptyNote}>{NOTHING_STORED}</TranscriptNote>;
  }
  return null;
};

interface TranscriptRowsProps {
  blocks: TranscriptBlock[];
  search: TranscriptSearch;
  follow: FollowPlayback;
  position: ReadingPosition;
  seek: ((positionMs: number) => void) | null;
  noun: "video" | "episode";
  playing: string;
  targetRun: ChapterBlockRun | null;
  openedFrom: OpenedFromChapter | null;
  openedFromStep: number | null;
  head: HTMLElement | null;
}

const chapterNumber = (number: number) => String(number).padStart(2, "0");

const TranscriptRows = ({
  blocks,
  search,
  follow,
  position,
  seek,
  noun,
  playing,
  targetRun,
  openedFrom,
  openedFromStep,
  head,
}: TranscriptRowsProps) => {
  const [currentMatch, setCurrentMatch] = useState<HTMLElement | null>(null);
  const [targetRow, setTargetRow] = useState<HTMLElement | null>(null);
  const analytics = useOverviewPageAnalytics();

  useEffect(() => {
    if (currentMatch !== null && head !== null) {
      scrollToRestingLine(currentMatch, head);
    }
  }, [currentMatch, head]);

  useEffect(() => {
    if (targetRow !== null && head !== null) {
      scrollToRestingLine(targetRow, head);
    }
  }, [targetRow, head]);

  const past = (index: number) => follow.currentBlockIndex !== -1 && index < follow.currentBlockIndex;
  const rowRefOf = (opensRun: boolean, restored: boolean, current: boolean) => {
    if (opensRun) {
      return setTargetRow;
    }
    if (restored) {
      return position.restoredRow;
    }
    return current ? follow.currentRow : undefined;
  };

  return (
    <div className={styles.rows} ref={position.rows}>
      {blocks.map((block, index) => {
        const current = index === follow.currentBlockIndex;
        const target = targetRun !== null && index >= targetRun.from && index <= targetRun.to;
        const opensRun = targetRun !== null && index === targetRun.from;
        const closesRun = targetRun !== null && index === targetRun.to;
        const restored = index === position.restoredBlockIndex;
        return (
          <div
            key={`${index}-${block.startMs}`}
            className={`${styles.row} ${current ? styles.rowCurrent : ""} ${target ? styles.rowTarget : ""} ${opensRun ? styles.rowTargetOpens : ""} ${closesRun ? styles.rowTargetCloses : ""} ${past(index) ? styles.rowPast : ""}`}
            ref={rowRefOf(opensRun, restored, current)}
            data-current={current}
            data-target={target}
            data-start-ms={block.startMs}
            data-testid={transcriptPanelTestIds.row}
          >
            {seek === null ? (
              <span className={styles.time} data-testid={transcriptPanelTestIds.rowTime}>
                {formatTimestamp(block.startMs)}
              </span>
            ) : (
              <button
                type="button"
                className={`${styles.time} ${styles.timeSeek}`}
                onClick={() => {
                  analytics.transcript.timestampChosen({ by: "skip" });
                  seek(block.startMs);
                }}
                aria-label={`Play the ${noun} from ${formatTimestamp(block.startMs)}`}
                data-testid={transcriptPanelTestIds.rowTime}
              >
                {formatTimestamp(block.startMs)}
              </button>
            )}
            <span className={styles.body}>
              {current && (
                <span className={styles.playingBadge} data-testid={transcriptPanelTestIds.playingBadge}>
                  <span className={styles.playingMark} aria-hidden="true" />
                  {playing}
                </span>
              )}
              {opensRun && openedFrom !== null && (
                <span className={styles.chapterChip} data-testid={transcriptPanelTestIds.chapterChip}>
                  Chapter {chapterNumber(openedFrom.number)} · {openedFrom.title}
                </span>
              )}
              {opensRun && openedFrom === null && openedFromStep !== null && (
                <span className={styles.chapterChip} data-testid={transcriptPanelTestIds.stepChip}>
                  Step {openedFromStep} starts here
                </span>
              )}
              <span className={styles.text}>
                {block.speakerChange && (
                  <span className={styles.speakerMark} data-testid={transcriptPanelTestIds.speakerMark}>
                    —
                  </span>
                )}
                <span data-testid={transcriptPanelTestIds.rowText}>
                  {blockParts(block.text, search.matchesInBlock(index)).map((part, partIndex) => {
                    if (part.match === null) {
                      return <Fragment key={partIndex}>{part.text}</Fragment>;
                    }
                    const isCurrentMatch = part.match === search.currentIndex;
                    return (
                      <mark
                        key={partIndex}
                        className={`${styles.match} ${isCurrentMatch ? styles.matchCurrent : ""}`}
                        ref={isCurrentMatch ? setCurrentMatch : undefined}
                        data-current={isCurrentMatch}
                        data-testid={transcriptPanelTestIds.match}
                      >
                        {part.text}
                      </mark>
                    );
                  })}
                </span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

interface TranscriptSearchBarProps {
  search: TranscriptSearch;
  onQueryChange: (query: string) => void;
}

// Why its own clear button: docs/features/stone-theme.md, "Transcript search".
const TranscriptSearchBar = ({ search, onQueryChange }: TranscriptSearchBarProps) => {
  const searching = search.query.trim() !== "";
  const found = search.matches.length;
  const input = useRef<HTMLInputElement | null>(null);
  const analytics = useOverviewPageAnalytics();
  const searchId = useId();

  const clear = () => {
    analytics.transcript.searchCleared();
    onQueryChange("");
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && found > 0) {
      event.preventDefault();
      analytics.transcript.matchStepped({ direction: event.shiftKey ? "previous" : "next" });
      search.step(event.shiftKey ? -1 : 1);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (search.query === "") {
        input.current?.blur();
        return;
      }
      analytics.transcript.searchCleared();
      onQueryChange("");
    }
  };

  return (
    <div className={`${styles.search} ${search.query !== "" ? styles.searchFilled : ""}`}>
      <span className={styles.searchIcon} aria-hidden="true">
        <StrokeIcon name="search" size={16} />
      </span>
      <input
        ref={input}
        id={searchId}
        name="transcript-search"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        className={styles.searchInput}
        placeholder="Search words or phrases"
        aria-label="Search the transcript"
        value={search.query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        data-testid={transcriptPanelTestIds.searchInput}
      />
      {search.query !== "" && <ClearFieldButton label="Clear search" onClick={clear} testId={transcriptPanelTestIds.clearSearchButton} />}
      {searching && (
        <span className={styles.searchResult}>
          <span
            className={`${styles.matchCount} ${found === 0 ? styles.matchCountEmpty : ""}`}
            role="status"
            data-testid={transcriptPanelTestIds.matchCount}
          >
            {found === 0 ? "No matches" : `${search.currentIndex + 1}/${found}`}
          </span>
          <span className={styles.searchGap} aria-hidden="true" />
          {/* Why disabled rather than gone, and wrapping: docs/features/stone-theme.md, "Transcript search". */}
          <button
            type="button"
            className={styles.stepMatch}
            onClick={() => {
              analytics.transcript.matchStepped({ direction: "previous" });
              search.step(-1);
            }}
            disabled={found === 0}
            aria-label="Previous match"
            data-testid={transcriptPanelTestIds.previousMatchButton}
          >
            <StrokeIcon name="chevronUp" size={16} />
          </button>
          <button
            type="button"
            className={styles.stepMatch}
            onClick={() => {
              analytics.transcript.matchStepped({ direction: "next" });
              search.step(1);
            }}
            disabled={found === 0}
            aria-label="Next match"
            data-testid={transcriptPanelTestIds.nextMatchButton}
          >
            <StrokeIcon name="chevronDown" size={16} />
          </button>
        </span>
      )}
    </div>
  );
};

interface TranscriptNoteProps {
  testId: string;
  children: ReactNode;
}

const TranscriptNote = ({ testId, children }: TranscriptNoteProps) => {
  return (
    <p className={styles.note} data-testid={testId}>
      {children}
    </p>
  );
};

const TranscriptSkeleton = () => {
  return (
    <div data-testid={transcriptPanelTestIds.skeleton}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <span className={styles.skeletonBar} />
          <span className={styles.skeletonLines}>
            <span className={styles.skeletonBar} />
            <span className={styles.skeletonBar} />
            <span className={styles.skeletonBar} style={{ width: "60%" }} />
          </span>
        </div>
      ))}
    </div>
  );
};
