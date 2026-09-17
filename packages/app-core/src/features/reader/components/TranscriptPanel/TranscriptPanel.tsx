import { useMemo, type ReactNode } from "react";
import type { VideoSource } from "@overview/types";
import { useTranscriptQuery } from "../../../transcripts/queries/transcriptQuery.js";
import { transcriptBlocks } from "../../../transcripts/util/transcriptBlocks.js";
import type { TranscriptBlock } from "../../../transcripts/types/TranscriptBlock.js";
import { youtubeTimestampUrl } from "../../../overviews/util/youtubeTimestampUrl.js";
import { formatTimestamp } from "../../../../util/formatTimestamp.js";
import styles from "./TranscriptPanel.module.scss";
import { transcriptPanelTestIds } from "./TranscriptPanelTestIds.js";

const SKELETON_ROWS = 4;

export interface TranscriptPanelProps {
  video: VideoSource;
}

export function TranscriptPanel({ video }: TranscriptPanelProps) {
  const transcriptQuery = useTranscriptQuery(video.id);
  const transcript = transcriptQuery.data ?? null;
  const blocks = useMemo(
    () => (transcript === null ? [] : transcriptBlocks(transcript.segments)),
    [transcript],
  );

  return (
    <div className={styles.root} data-testid={transcriptPanelTestIds.root}>
      <p className={styles.head}>
        <span>Full transcript</span>
        {transcript?.generated === true && (
          <span className={styles.sourceNote} data-testid={transcriptPanelTestIds.sourceNote}>
            Machine-transcribed
          </span>
        )}
      </p>
      {transcriptBody(video, {
        blocks,
        isPending: transcriptQuery.isPending,
        error: transcriptQuery.isError ? transcriptQuery.error : null,
      })}
    </div>
  );
}

interface TranscriptState {
  blocks: TranscriptBlock[];
  isPending: boolean;
  error: Error | null;
}

function transcriptBody(video: VideoSource, { blocks, isPending, error }: TranscriptState): ReactNode {
  if (video.id === null) {
    return <TranscriptNote testId={transcriptPanelTestIds.emptyNote}>{NOTHING_STORED}</TranscriptNote>;
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
    return <TranscriptNote testId={transcriptPanelTestIds.emptyNote}>{NOTHING_STORED}</TranscriptNote>;
  }
  return blocks.map((block, index) => (
    <a
      key={`${index}-${block.startMs}`}
      className={styles.row}
      href={youtubeTimestampUrl(video.url, block.startMs)}
      target="_blank"
      rel="noreferrer"
      data-testid={transcriptPanelTestIds.row}
    >
      <span className={styles.time} data-testid={transcriptPanelTestIds.rowTime}>
        {formatTimestamp(block.startMs)}
      </span>
      <span className={styles.text} data-testid={transcriptPanelTestIds.rowText}>
        {block.text}
      </span>
    </a>
  ));
}

const NOTHING_STORED = "No transcript was stored for this note. Generating it again keeps one.";

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
