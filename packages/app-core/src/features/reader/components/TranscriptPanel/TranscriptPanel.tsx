import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import type { VideoSource } from "@overview/domain";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { useTranscriptQuery } from "../../../transcripts/queries/transcriptQuery.js";
import { blockParts } from "../../../transcripts/util/blockParts.js";
import { transcriptBlocks } from "../../../transcripts/util/transcriptBlocks.js";
import { transcriptFileName } from "../../../transcripts/util/transcriptFileName.js";
import { transcriptPlainText } from "../../../transcripts/util/transcriptPlainText.js";
import type { TranscriptBlock } from "../../../transcripts/types/TranscriptBlock.js";
import { formatTimestamp } from "../../../../util/formatTimestamp.js";
import { useFollowPlayback, type FollowPlayback } from "./useFollowPlayback.js";
import { useTranscriptSearch, type TranscriptSearch } from "./useTranscriptSearch.js";
import styles from "./TranscriptPanel.module.scss";
import { transcriptPanelTestIds } from "./TranscriptPanelTestIds.js";

const SKELETON_ROWS = 4;
const COPIED_MS = 2000;
const NOTHING_STORED = "No transcript was stored for this note. Generating it again keeps one.";

export interface TranscriptPanelProps {
  video: VideoSource;
}

const canCopy = (): boolean => typeof navigator.clipboard?.writeText === "function";

export function TranscriptPanel({ video }: TranscriptPanelProps) {
  const transcriptQuery = useTranscriptQuery(video.id);
  const transcript = transcriptQuery.data ?? null;
  const blocks = useMemo(
    () => (transcript === null ? [] : transcriptBlocks(transcript.segments)),
    [transcript],
  );

  const search = useTranscriptSearch(blocks);
  const follow = useFollowPlayback(video.id, blocks);
  const seek = useSeekPlayback(video.id);
  const [copied, setCopied] = useState(false);

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
    isPending: transcriptQuery.isPending,
    error: transcriptQuery.isError ? transcriptQuery.error : null,
    blocks,
  });

  return (
    <div className={styles.root} data-testid={transcriptPanelTestIds.root}>
      <div className={styles.head}>
        <div className={styles.headingRow}>
          <p className={styles.heading}>
            Full transcript
            {transcript?.generated === true && (
              <span className={styles.sourceNote} data-testid={transcriptPanelTestIds.sourceNote}>
                Machine-transcribed
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

      {follow.following && (
        <p className={styles.following} data-testid={transcriptPanelTestIds.followingNote}>
          <span className={styles.followingMark} aria-hidden="true">
            ●
          </span>
          Following the video
        </p>
      )}

      {unreadable ?? <TranscriptRows blocks={blocks} search={search} follow={follow} seek={seek} />}

      {follow.offered && (
        <button
          type="button"
          className={styles.followButton}
          onClick={followPlayback}
          data-testid={transcriptPanelTestIds.followButton}
        >
          ↓ Follow playback
        </button>
      )}
    </div>
  );
}

interface TranscriptState {
  blocks: TranscriptBlock[];
  isPending: boolean;
  error: Error | null;
}

// Null means there are blocks to read, which is the one case the tools and the search
// box are worth drawing for.
function unreadableTranscript(
  video: VideoSource,
  { blocks, isPending, error }: TranscriptState,
): ReactNode | null {
  if (video.id === null) {
    return (
      <TranscriptNote testId={transcriptPanelTestIds.emptyNote}>{NOTHING_STORED}</TranscriptNote>
    );
  }
  if (error) {
    return (
      <TranscriptNote testId={transcriptPanelTestIds.errorNote}>
        Couldn't load this transcript: {error.message}
      </TranscriptNote>
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
  seek: ((positionMs: number) => void) | null;
}

function TranscriptRows({ blocks, search, follow, seek }: TranscriptRowsProps) {
  const [currentMatch, setCurrentMatch] = useState<HTMLElement | null>(null);

  useEffect(() => {
    currentMatch?.scrollIntoView({ block: "center" });
  }, [currentMatch]);

  return (
    <>
      {blocks.map((block, index) => {
        const current = index === follow.currentBlockIndex;
        return (
          <div
            key={`${index}-${block.startMs}`}
            className={`${styles.row} ${current ? styles.rowCurrent : ""}`}
            ref={current ? follow.currentRow : undefined}
            data-current={current}
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
          </div>
        );
      })}
    </>
  );
}

interface TranscriptSearchBarProps {
  search: TranscriptSearch;
  onQueryChange: (query: string) => void;
}

function TranscriptSearchBar({ search, onQueryChange }: TranscriptSearchBarProps) {
  const searching = search.query.trim() !== "";

  return (
    <div className={styles.search}>
      <SearchIcon />
      <input
        type="search"
        className={styles.searchInput}
        placeholder="Search words or phrases"
        aria-label="Search the transcript"
        value={search.query}
        onChange={(event) => onQueryChange(event.target.value)}
        data-testid={transcriptPanelTestIds.searchInput}
      />
      {searching && (
        <>
          <span
            className={styles.matchCount}
            role="status"
            data-testid={transcriptPanelTestIds.matchCount}
          >
            {search.matches.length === 0
              ? "No matches"
              : `${search.currentIndex + 1}/${search.matches.length}`}
          </span>
          <span className={styles.searchDivider} aria-hidden="true" />
          <button
            type="button"
            className={styles.stepMatch}
            onClick={() => search.step(-1)}
            disabled={search.matches.length === 0}
            aria-label="Previous match"
            data-testid={transcriptPanelTestIds.previousMatchButton}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.stepMatch}
            onClick={() => search.step(1)}
            disabled={search.matches.length === 0}
            aria-label="Next match"
            data-testid={transcriptPanelTestIds.nextMatchButton}
          >
            ↓
          </button>
        </>
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

function SearchIcon() {
  return (
    <svg
      className={styles.searchIcon}
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.2" y1="16.2" x2="21" y2="21" />
    </svg>
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
