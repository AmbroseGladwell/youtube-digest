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
  // Another conversation about the overview an answer drew on, or null once it is deleted.
  conversationOf: (chatId: string) => { date: string; firstQuestion: string } | null;
  onConversationFollowed: (chatId: string, message: number) => void;
  // Copy and Continue in, under the latest answer only (design 310k).
  actions?: ReactNode;
}

const paragraphsOf = (text: string) => text.split(/\n+/).filter((paragraph) => paragraph.trim() !== "");

const conversationsOf = (citations: readonly ChatCitation[]) =>
  citations
    .flatMap((citation) => ("chatId" in citation ? [citation] : []))
    .filter((citation, index, all) => all.findIndex((each) => each.chatId === citation.chatId) === index);

const stretchesOf = (citations: readonly ChatCitation[]): TimeRange[] =>
  citations.flatMap((citation) => ("startMs" in citation ? [citation] : [])).sort((a, b) => a.startMs - b.startMs);

// Design 310k–310m, 310w, 310y: an answer is plain text on the panel. Under the whole of it, the
// other conversations it drew on are links that open words, then its stretches of the video are
// pills that play, in time order. One the source doesn't cover says so, muted: an answer, not an
// error.
export function ChatAnswer({
  text,
  inSource,
  citations,
  sourceWord,
  video,
  onCitationFollowed,
  onOpenTranscriptAt,
  conversationOf,
  onConversationFollowed,
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
      {conversationsOf(citations).map(({ chatId, message }) => {
        const cited = conversationOf(chatId);
        if (cited === null)
          return (
            <p key={chatId} className={styles.deletedConversation} data-testid={chatAnswerTestIds.deletedConversation}>
              <StrokeIcon name="chat" size={14} />
              From a conversation you deleted
            </p>
          );
        return (
          <button
            key={chatId}
            type="button"
            className={styles.conversation}
            aria-label={`Open your conversation from ${cited.date}: ${cited.firstQuestion}`}
            onClick={() => onConversationFollowed(chatId, message)}
            data-testid={chatAnswerTestIds.conversation}
          >
            <StrokeIcon name="chat" size={14} />
            <span>
              <span className={styles.conversationFrom}>From your conversation · {cited.date}</span>
              <span className={styles.conversationQuestion}>“{cited.firstQuestion}”</span>
            </span>
          </button>
        );
      })}
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
