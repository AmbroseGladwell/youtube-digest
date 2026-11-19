import { Fragment, type ReactNode } from "react";
import {
  articlePlaceUrl,
  type ArticlePlace,
  type ChatCitation,
  type ChatSourceKind,
  type Overview,
  type TimeRange,
  type VideoSource,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { ChatCitationPill } from "../ChatCitationPill/ChatCitationPill.js";
import { ChatOverviewCitation, type ChatOverviewCitationProps } from "../ChatOverviewCitation/ChatOverviewCitation.js";
import type { ShowOnPage } from "../../../reader/useShowOnPage.js";
import { chatWords } from "../../util/chatWords.js";
import { overviewCitationViews } from "../../util/overviewCitationView.js";
import styles from "./ChatAnswer.module.scss";
import { chatAnswerTestIds } from "./ChatAnswerTestIds.js";

export interface ChatAnswerProps {
  text: string;
  inSource: boolean;
  citations: readonly ChatCitation[];
  about: ChatSourceKind;
  arrived?: boolean;
  // An article's or a recipe page's own page: a decline offers it, and a cited key point or
  // chapter can be shown on it, beside the article in the extension (OV-320).
  page: ChatPage | null;
  video: VideoSource | null;
  overview: Overview;
  onCitationFollowed: (range: TimeRange) => void;
  onOverviewPartFollowed: ChatOverviewCitationProps["onFollowed"];
  onOpenTranscriptAt: (positionMs: number) => void;
  // Another conversation about the overview an answer drew on, or null once it is deleted.
  conversationOf: (chatId: string) => { date: string; firstQuestion: string } | null;
  onConversationFollowed: (chatId: string, message: number) => void;
  // Copy, under each answer (design 324x).
  actions?: ReactNode;
}

export interface ChatPage {
  url: string;
  onPage: ShowOnPage | null;
}

const paragraphsOf = (text: string) => text.split(/\n+/).filter((paragraph) => paragraph.trim() !== "");

const conversationsOf = (citations: readonly ChatCitation[]) =>
  citations
    .flatMap((citation) => ("chatId" in citation ? [citation] : []))
    .filter((citation, index, all) => all.findIndex((each) => each.chatId === citation.chatId) === index);

const stretchesOf = (citations: readonly ChatCitation[]): TimeRange[] =>
  citations.flatMap((citation) => ("startMs" in citation ? [citation] : [])).sort((a, b) => a.startMs - b.startMs);

// Design 310k–310m, 310w, 310y: an answer is plain text on the panel. Under the whole of it, the
// other conversations it drew on are links that open words, then one row of pills: the parts of
// the overview it rests on in the note's order, then its stretches of the video in time order
// (319c). One the source doesn't cover says so in a label above it, its text as plain as any
// other: an answer, not an error. One from the overview has no label: its pills and its wording
// say so (319k). One that has just arrived fades in what streaming didn't show (OV-341).
export function ChatAnswer({
  text,
  inSource,
  citations,
  about,
  arrived = false,
  page,
  video,
  overview,
  onCitationFollowed,
  onOverviewPartFollowed,
  onOpenTranscriptAt,
  conversationOf,
  onConversationFollowed,
  actions,
}: ChatAnswerProps) {
  const stretches = video === null ? [] : stretchesOf(citations);
  const parts = overviewCitationViews(overview, citations);
  const notCovered = !inSource && !citations.some((citation) => "part" in citation);
  return (
    <div className={`${styles.root} ${arrived ? styles.arrived : ""}`} data-testid={chatAnswerTestIds.root}>
      {notCovered && (
        <p className={styles.notInSourceLabel} data-testid={chatAnswerTestIds.notInSource}>
          <StrokeIcon name="ban" size={14} />
          {chatWords(about).notCovered}
        </p>
      )}
      <div className={styles.text} data-testid={chatAnswerTestIds.text}>
        {paragraphsOf(text).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {notCovered && page !== null && page.onPage === null && (
        <a className={styles.onPage} href={page.url} target="_blank" rel="noopener" data-testid={chatAnswerTestIds.readOnPage}>
          Read it on the page
          <StrokeIcon name="openOut" size={13} />
        </a>
      )}
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
      {parts.length + stretches.length > 0 && (
        <div className={styles.citations} data-testid={chatAnswerTestIds.citations}>
          {parts.map((view, index) => (
            <Fragment key={`${view.part}-${index}`}>
              <ChatOverviewCitation view={view} onFollowed={onOverviewPartFollowed} />
              {page !== null && view.kind === "item" && view.place !== undefined && <ShowOnPageLink page={page} place={view.place} />}
            </Fragment>
          ))}
          {video !== null &&
            stretches.map((range) => (
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

// Design 319 for OV-320: a plain link beside an article's key point or chapter. Beside the
// article it moves the page; anywhere else it opens the page at that place in a new tab.
function ShowOnPageLink({ page, place }: { page: ChatPage; place: ArticlePlace }) {
  if (page.onPage !== null) {
    const { onPage } = page;
    if (onPage.statusOf(place) === "missing") return null;
    return (
      <button type="button" className={styles.onPage} onClick={() => onPage.show(place)} data-testid={chatAnswerTestIds.showOnPage}>
        Show on the page
      </button>
    );
  }
  return (
    <a
      className={styles.onPage}
      href={articlePlaceUrl(page.url, place)}
      target="_blank"
      rel="noopener"
      data-testid={chatAnswerTestIds.showOnPage}
    >
      Show on the page
      <StrokeIcon name="openOut" size={13} />
    </a>
  );
}
