import { transcriptBlocks, transcriptPlainText, formatTimestamp } from "@overview/domain";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { StoredTranscript, VideoSource, TranscriptBlock } from "@overview/domain";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { useTranscriptQuery } from "../../../transcripts/queries/transcriptQuery.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";
import { blockParts } from "../../../transcripts/util/blockParts.js";
import { transcriptFileName } from "../../../transcripts/util/transcriptFileName.js";
import { ClearFieldButton } from "../../../../components/shared/ClearFieldButton/ClearFieldButton.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useFollowPlayback, type FollowPlayback } from "./useFollowPlayback.js";
import { useReadingPosition, type ReadingPosition } from "./useReadingPosition.js";
import { useTranscriptSearch, type TranscriptSearch } from "./useTranscriptSearch.js";
import { scrollToRestingLine } from "./scrollToRestingLine.js";
import styles from "./TranscriptPanel.module.scss";
import { transcriptPanelTestIds } from "./TranscriptPanelTestIds.js";

const SKELETON_ROWS = 4;
const COPIED_MS = 2000;
const NOTHING_STORED = "No transcript was stored for this note. Generating it again keeps one.";

export interface OpenedFromChapter {
  number: number;
  title: string;
}

export interface TranscriptPanelProps {
  video: VideoSource;
  // A transcript the caller already holds — the shared page's own copy, which travels with
// the shared overview rather than being read out of a store the visitor has not got
// (docs/features/sharing.md). Absent, the panel reads the reader's own store.
  held?: StoredTranscript | null;
  // Where a chapter asked the transcript to open, or null when the reader chose the tab
  // themselves (docs/features/chapters.md).
  openAtMs: number | null;
  // The chapter that asked, named on the block it opened at and offered a way back
  // (design 2c).
  openedFrom: OpenedFromChapter | null;
  onBackToChapters: () => void;
}

const canCopy = (): boolean => typeof navigator.clipboard?.writeText === "function";

export function TranscriptPanel({ video, held, openAtMs, openedFrom, onBackToChapters }: TranscriptPanelProps) {
  const transcriptQuery = useTranscriptQuery(held === undefined ? video.id : null);
  const transcript = held ?? transcriptQuery.data ?? null;
  const blocks = useMemo(
    () => (transcript === null ? [] : transcriptBlocks(transcript.segments)),
    [transcript],
  );

  // The head is state rather than a ref because every scroll below is measured off it,
  // and those have to run again once it is there.
  const [head, setHead] = useState<HTMLDivElement | null>(null);
  const search = useTranscriptSearch(blocks);
  const targetBlockIndex = openAtMs === null ? -1 : blockAtPosition(blocks, openAtMs);
  const position = useReadingPosition(video.id, blocks, { ignored: openAtMs !== null, head });
  const follow = useFollowPlayback(video.id, blocks, {
    held: position.restoredBlockIndex !== -1,
    head,
  });
  const seek = useSeekPlayback(video.id);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    position.setRemembering(!follow.following);
  }, [position.setRemembering, follow.following]);

  // Opening at a chapter is scrolling away from the video, the same as searching is.
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
    void navigator.clipboard.writeText(plainText()).then(() => setCopied(true));
  };

  // A Blob and an object URL rather than a data: URL, which a long transcript would
  // overrun.
  const exportFile = () => {
    const href = URL.createObjectURL(new Blob([plainText()], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = transcriptFileName(video);
    link.click();
    URL.revokeObjectURL(href);
  };

  // Searching is scrolling away from the video, so it stands the following down rather
  // than the two fighting over the scroll position.
  const searchFor = (query: string) => {
    search.setQuery(query);
    if (query.trim() !== "") {
      follow.stop();
    }
  };

  const followPlayback = () => {
    search.setQuery("");
    follow.follow();
  };

  const unreadable = unreadableTranscript(video, {
    isPending: held === undefined && transcriptQuery.isPending,
    error: held === undefined && transcriptQuery.isError ? transcriptQuery.error : null,
    blocks,
    retry: () => void transcriptQuery.refetch(),
  });

  const currentBlock = blocks[follow.currentBlockIndex] ?? null;

  return (
    <div className={styles.root} data-testid={transcriptPanelTestIds.root}>
      <div className={styles.head} ref={setHead} data-testid={transcriptPanelTestIds.head}>
        <div className={styles.headingRow}>
          {/* Design 2a–2c: what the row's left says is the transcript's relationship to
              the video — the way back to the chapter that opened it, or whether it is
              following — and only a transcript with no player to follow is labelled. */}
          <p className={styles.heading}>
            {openedFrom !== null ? (
              <button
                type="button"
                className={styles.backToChapters}
                onClick={onBackToChapters}
                data-testid={transcriptPanelTestIds.backToChaptersButton}
              >
                <StrokeIcon name="arrowLeft" size={14} />
                Back to chapters
              </button>
            ) : follow.following ? (
              <span className={styles.following} data-testid={transcriptPanelTestIds.followingNote}>
                <span className={styles.followingMark} aria-hidden="true" />
                Following the video
              </span>
            ) : follow.offered ? (
              <span className={styles.notFollowing} data-testid={transcriptPanelTestIds.notFollowingNote}>
                Not following · you scrolled away
              </span>
            ) : (
              <span className={styles.label}>Full transcript</span>
            )}
            {transcript?.generated === true && (
              <span className={styles.sourceNote} data-testid={transcriptPanelTestIds.sourceNote}>
                Auto-generated
              </span>
            )}
          </p>

          {unreadable === null && (
            <div className={styles.toolRow} data-testid={transcriptPanelTestIds.tools}>
              {canCopy() && (
                <button
                  type="button"
                  className={styles.tool}
                  onClick={copy}
                  data-testid={transcriptPanelTestIds.copyButton}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              <button
                type="button"
                className={styles.tool}
                onClick={exportFile}
                data-testid={transcriptPanelTestIds.exportButton}
              >
                Export
              </button>
            </div>
          )}
        </div>

        {unreadable === null && <TranscriptSearchBar search={search} onQueryChange={searchFor} />}
      </div>

      {unreadable ?? (
        <TranscriptRows
          blocks={blocks}
          search={search}
          follow={follow}
          position={position}
          seek={seek}
          targetBlockIndex={targetBlockIndex}
          openedFrom={openedFrom}
          head={head}
        />
      )}

      {/* Design 2b: the way back names where the video is, and the dot is the same one
          the following note carries. */}
      {follow.offered && (
        <button
          type="button"
          className={styles.followButton}
          onClick={followPlayback}
          data-testid={transcriptPanelTestIds.followButton}
        >
          <span className={styles.followButtonMark} aria-hidden="true" />
          {currentBlock === null ? "Back to the video" : `Back to ${formatTimestamp(currentBlock.startMs)}`}
        </button>
      )}
    </div>
  );
}

interface TranscriptState {
  blocks: TranscriptBlock[];
  isPending: boolean;
  error: Error | null;
  retry: () => void;
}

// Null means there are blocks to read, which is the one case the tools and the search
// box are worth drawing for.
function unreadableTranscript(
  video: VideoSource,
  { blocks, isPending, error, retry }: TranscriptState,
): ReactNode | null {
  if (video.id === null) {
    return (
      <TranscriptNote testId={transcriptPanelTestIds.emptyNote}>{NOTHING_STORED}</TranscriptNote>
    );
  }
  if (error) {
    return (
      <div className={styles.failed}>
        <TranscriptNote testId={transcriptPanelTestIds.errorNote}>
          Couldn't load this transcript: {error.message}
        </TranscriptNote>
        <button
          type="button"
          className={styles.tool}
          onClick={retry}
          data-testid={transcriptPanelTestIds.retryButton}
        >
          Try again
        </button>
      </div>
    );
  }
  if (isPending) {
    return <TranscriptSkeleton />;
  }
  if (blocks.length === 0) {
    return (
      <TranscriptNote testId={transcriptPanelTestIds.emptyNote}>{NOTHING_STORED}</TranscriptNote>
    );
  }
  return null;
}

interface TranscriptRowsProps {
  blocks: TranscriptBlock[];
  search: TranscriptSearch;
  follow: FollowPlayback;
  position: ReadingPosition;
  seek: ((positionMs: number) => void) | null;
  targetBlockIndex: number;
  openedFrom: OpenedFromChapter | null;
  head: HTMLElement | null;
}

const chapterNumber = (number: number) => String(number).padStart(2, "0");

function TranscriptRows({
  blocks,
  search,
  follow,
  position,
  seek,
  targetBlockIndex,
  openedFrom,
  head,
}: TranscriptRowsProps) {
  const [currentMatch, setCurrentMatch] = useState<HTMLElement | null>(null);
  const [targetRow, setTargetRow] = useState<HTMLElement | null>(null);

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

  // Design 2a: paragraphs the video has already passed drop to the muted ink, so the
  // eye finds the one being spoken by weight before it finds the card.
  const past = (index: number) => follow.currentBlockIndex !== -1 && index < follow.currentBlockIndex;

  return (
    <div className={styles.rows} ref={position.rows}>
      {blocks.map((block, index) => {
        const current = index === follow.currentBlockIndex;
        const target = index === targetBlockIndex;
        const restored = index === position.restoredBlockIndex;
        return (
          <div
            key={`${index}-${block.startMs}`}
            className={`${styles.row} ${current ? styles.rowCurrent : ""} ${target ? styles.rowTarget : ""} ${past(index) ? styles.rowPast : ""}`}
            ref={
              target
                ? setTargetRow
                : restored
                  ? position.restoredRow
                  : current
                    ? follow.currentRow
                    : undefined
            }
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
                onClick={() => seek(block.startMs)}
                aria-label={`Play the video from ${formatTimestamp(block.startMs)}`}
                data-testid={transcriptPanelTestIds.rowTime}
              >
                {formatTimestamp(block.startMs)}
              </button>
            )}
            <span className={styles.body}>
              {current && (
                <span className={styles.playingBadge} data-testid={transcriptPanelTestIds.playingBadge}>
                  <span className={styles.playingMark} aria-hidden="true" />
                  Playing on YouTube
                </span>
              )}
              {target && openedFrom !== null && (
                <span className={styles.chapterChip} data-testid={transcriptPanelTestIds.chapterChip}>
                  Chapter {chapterNumber(openedFrom.number)} · {openedFrom.title}
                </span>
              )}
              <span className={styles.text}>
              {block.speakerChange && (
                <span
                  className={styles.speakerMark}
                  data-testid={transcriptPanelTestIds.speakerMark}
                >
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
}

interface TranscriptSearchBarProps {
  search: TranscriptSearch;
  onQueryChange: (query: string) => void;
}

// The field's own clear button, in place of the browser's blue cancel glyph, so all
// three round controls in the pill are the one size, colour and hover
// (docs/features/stone-theme.md, "Transcript search").
function TranscriptSearchBar({ search, onQueryChange }: TranscriptSearchBarProps) {
  const searching = search.query.trim() !== "";
  const found = search.matches.length;
  const input = useRef<HTMLInputElement | null>(null);

  const clear = () => {
    onQueryChange("");
    input.current?.focus();
  };

  // Enter walks the hits the way a browser's own find does, and Escape empties the
  // field before it gives the page back.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && found > 0) {
      event.preventDefault();
      search.step(event.shiftKey ? -1 : 1);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (search.query === "") {
        input.current?.blur();
        return;
      }
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
        type="search"
        className={styles.searchInput}
        placeholder="Search words or phrases"
        aria-label="Search the transcript"
        value={search.query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        data-testid={transcriptPanelTestIds.searchInput}
      />
      {search.query !== "" && (
        <ClearFieldButton
          label="Clear search"
          onClick={clear}
          testId={transcriptPanelTestIds.clearSearchButton}
        />
      )}
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
          {/* The steppers stay in place with nothing to walk, disabled rather than gone,
              so the field does not change width as you type (design 1a, "No matches").
              They wrap rather than stopping at either end, which is why neither is
              disabled at the first hit the way the design's frame shows. */}
          <button
            type="button"
            className={styles.stepMatch}
            onClick={() => search.step(-1)}
            disabled={found === 0}
            aria-label="Previous match"
            data-testid={transcriptPanelTestIds.previousMatchButton}
          >
            <StrokeIcon name="chevronUp" size={16} />
          </button>
          <button
            type="button"
            className={styles.stepMatch}
            onClick={() => search.step(1)}
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
}

function TranscriptNote({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <p className={styles.note} data-testid={testId}>
      {children}
    </p>
  );
}

function TranscriptSkeleton() {
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
}
