import type { ReactNode } from "react";
import type { ChatCitation, TimeRange, VideoSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { ChatCitationPill } from "../ChatCitationPill/ChatCitationPill.js";
import styles from "./ChatAnswer.module.scss";
import { chatAnswerTestIds } from "./ChatAnswerTestIds.js";

export interface ChatAnswerProps {
  text: string;
  inSource: boolean;
  citations: readonly ChatCitation[];
  // "video" or "episode", for "Not in the video".
  sourceWord: string;
  video: VideoSource | null;
  onCitationFollowed: (range: TimeRange) => void;
  onOpenTranscriptAt: (positionMs: number) => void;
  // Copy and Continue in, under the latest answer only (design 310k).
  actions?: ReactNode;
}

const paragraphsOf = (text: string) => text.split(/\n+/).filter((paragraph) => paragraph.trim() !== "");

const stretchesOf = (citations: readonly ChatCitation[]): TimeRange[] =>
  citations.flatMap((citation) => ("startMs" in citation ? [citation] : [])).sort((a, b) => a.startMs - b.startMs);

// Design 310k–310m: an answer is plain text on the panel, its stretches of the video as pills
// under the whole of it, in time order. One the source doesn't cover says so, muted, with no
// citations: an answer, not an error.
export function ChatAnswer({
  text,
  inSource,
  citations,
  sourceWord,
  video,
  onCitationFollowed,
  onOpenTranscriptAt,
  actions,
}: ChatAnswerProps) {
  const stretches = video === null ? [] : stretchesOf(citations);
  return (
    <div className={`${styles.root} ${inSource ? "" : styles.notInSource}`} data-testid={chatAnswerTestIds.root}>
      {!inSource && (
        <p className={styles.notInSourceLabel} data-testid={chatAnswerTestIds.notInSource}>
          <StrokeIcon name="ban" size={14} />
          Not in the {sourceWord}
        </p>
      )}
      <div className={styles.text} data-testid={chatAnswerTestIds.text}>
        {paragraphsOf(text).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {video !== null && stretches.length > 0 && (
        <div className={styles.citations} data-testid={chatAnswerTestIds.citations}>
          {stretches.map((range) => (
            <ChatCitationPill
              key={`${range.startMs}-${range.endMs}`}
              range={range}
              video={video}
              onFollowed={onCitationFollowed}
              onOpenTranscriptAt={onOpenTranscriptAt}
            />
          ))}
        </div>
      )}
      {actions}
    </div>
  );
}
