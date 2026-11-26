import { Fragment, useRef, useState, type ReactNode } from "react";
import {
  articlePlaceUrl,
  formatTimestamp,
  holdsCodeBlock,
  type ArticlePlace,
  type ChatAnswerSections,
  type ChatCitation,
  type ChatSourceKind,
  type OtherOverviewCitation,
  type Overview,
  type SpokenAnswerPlace,
  type TimeRange,
  type VideoSource,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { ChatCitationPill } from "../ChatCitationPill/ChatCitationPill.js";
import { ChatChipRow } from "../ChatChipRow/ChatChipRow.js";
import { ChatAnswerText } from "../ChatAnswerText/ChatAnswerText.js";
import { ChatMarkedText } from "../ChatMarkedText/ChatMarkedText.js";
import {
  ChatOtherOverviewCitation,
  otherOverviewCitationPlace,
  type ChatOtherOverviewCitationProps,
} from "../ChatOtherOverviewCitation/ChatOtherOverviewCitation.js";
import { ChatOverviewCitation, type ChatOverviewCitationProps } from "../ChatOverviewCitation/ChatOverviewCitation.js";
import type { ShowOnPage } from "../../../reader/useShowOnPage.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import type { SentenceOnScreen } from "../../readAloud/ReadAloudEngine.js";
import { SpokenSentenceProvider, useSpokenRange } from "../../readAloud/SpokenSentenceContext.js";
import { useTallerThanView } from "../../readAloud/useTallerThanView.js";
import { chatWords } from "../../util/chatWords.js";
import { byRelation, citationKey } from "../../util/chatSourceGroups.js";
import { overviewCitationViews } from "../../util/overviewCitationView.js";
import styles from "./ChatAnswer.module.scss";
import { chatAnswerTestIds } from "./ChatAnswerTestIds.js";

export interface ConversationSummary {
  date: string;
  firstQuestion: string;
}

export interface OverviewImage {
  url: string | null;
  wide: boolean;
}

export interface ChatAnswerProps {
  text: string;
  inSource: boolean;
  citations: readonly ChatCitation[];
  about: ChatSourceKind;
  arrived?: boolean;
  page: ChatPage | null;
  video: VideoSource | null;
  overview: Overview;
  onCitationFollowed: (range: TimeRange) => void;
  onOverviewPartFollowed: ChatOverviewCitationProps["onFollowed"];
  onOpenTranscriptAt: (positionMs: number) => void;
  conversationOf: (chatId: string) => ConversationSummary | null;
  onConversationFollowed: (chatId: string, message: number) => void;
  holdsOverview: (overviewId: string) => boolean;
  onOtherOverviewFollowed: ChatOtherOverviewCitationProps["onFollowed"];
  sections?: ChatAnswerSections | undefined;
  imageOf?: ((overviewId: string) => OverviewImage) | undefined;
  onSourcesOpened?: ((count: number) => void) | undefined;
  actions?: ((sources: ReactNode) => ReactNode) | undefined;
  spoken?: SentenceOnScreen | null | undefined;
  top?: ReactNode;
}

export interface ChatChip {
  chip: ReactNode;
  label: string;
}

export const otherOverviewChipLabel = (citation: OtherOverviewCitation): string => {
  const place = otherOverviewCitationPlace(citation);
  return place === undefined ? citation.title : `${citation.title} · ${place}`;
};

export interface ChatPage {
  url: string;
  onPage: ShowOnPage | null;
}

const conversationsOf = (citations: readonly ChatCitation[]) =>
  citations
    .flatMap((citation) => ("chatId" in citation ? [citation] : []))
    .filter((citation, index, all) => all.findIndex((each) => each.chatId === citation.chatId) === index);

const otherOverviewsOf = (citations: readonly ChatCitation[]) =>
  citations.flatMap((citation) => ("overviewId" in citation ? [citation] : []));

const stretchesOf = (citations: readonly ChatCitation[]): TimeRange[] =>
  citations.flatMap((citation) => ("startMs" in citation ? [citation] : [])).sort((a, b) => a.startMs - b.startMs);

export const ChatAnswer = ({
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
  holdsOverview,
  onOtherOverviewFollowed,
  sections,
  imageOf,
  onSourcesOpened,
  actions,
  spoken = null,
  top,
}: ChatAnswerProps) => {
  const root = useRef<HTMLDivElement | null>(null);
  const taller = useTallerThanView(root);
  const stretches = video === null ? [] : stretchesOf(citations);
  const parts = overviewCitationViews(overview, citations);
  const others = otherOverviewsOf(citations);
  const notCovered = !inSource && !citations.some((citation) => "part" in citation) && others.length === 0;

  const chipsOf = (cited: readonly ChatCitation[]): ChatChip[] => {
    const own = overviewCitationViews(overview, cited).map((view, index) => ({
      label: view.kind === "gone" ? view.section : view.label,
      chip: (
        <Fragment key={`${view.part}-${index}`}>
          <ChatOverviewCitation view={view} onFollowed={onOverviewPartFollowed} />
          {page !== null && view.kind === "item" && view.place !== undefined && <ShowOnPageLink page={page} place={view.place} />}
        </Fragment>
      ),
    }));
    const times =
      video === null
        ? []
        : stretchesOf(cited).map((range) => ({
            label: formatTimestamp(range.startMs),
            chip: (
              <ChatCitationPill
                key={`${range.startMs}-${range.endMs}`}
                range={range}
                video={video}
                onFollowed={onCitationFollowed}
                onOpenTranscriptAt={onOpenTranscriptAt}
              />
            ),
          }));
    const elsewhere = otherOverviewsOf(cited).map((citation, index) => {
      const image = imageOf?.(citation.overviewId);
      return {
        label: otherOverviewChipLabel(citation),
        chip: (
          <ChatOtherOverviewCitation
            key={`${citation.overviewId}-${index}`}
            citation={citation}
            held={holdsOverview(citation.overviewId)}
            imageUrl={image?.url}
            wide={image?.wide}
            onFollowed={onOtherOverviewFollowed}
          />
        ),
      };
    });
    return [...own, ...times, ...elsewhere];
  };

  const listed = citations
    .filter((citation) => !("chatId" in citation))
    .filter((citation, index, all) => all.findIndex((each) => citationKey(each) === citationKey(citation)) === index);
  const sourcesMenu =
    sections === undefined || listed.length === 0 ? null : (
      <ChatSourcesMenu count={listed.length} onOpened={onSourcesOpened}>
        {chipsOf(listed).map((each) => each.chip)}
      </ChatSourcesMenu>
    );
  return (
    <SpokenSentenceProvider value={spoken}>
      <div className={`${styles.root} ${arrived ? styles.arrived : ""}`} ref={root} data-testid={chatAnswerTestIds.root}>
        {taller && top !== undefined && <div className={styles.top}>{top}</div>}
        {notCovered && (
          <p className={styles.notInSourceLabel} data-testid={chatAnswerTestIds.notInSource}>
            <StrokeIcon name="ban" size={14} />
            {chatWords(about).notCovered}
          </p>
        )}
        {sections === undefined ? (
          <div className={styles.text} data-testid={chatAnswerTestIds.text}>
            <ChatAnswerText text={text} place={PLAIN} />
          </div>
        ) : (
          <div className={styles.text} data-testid={chatAnswerTestIds.text}>
            <ChatAnswerSectionsView sections={sections} chipsOf={chipsOf} />
          </div>
        )}
        {notCovered && page !== null && page.onPage === null && (
          <a className={styles.onPage} href={page.url} target="_blank" rel="noopener" data-testid={chatAnswerTestIds.readOnPage}>
            Read it on the page
            <StrokeIcon name="openOut" size={13} />
          </a>
        )}
        {conversationsOf(citations).map(({ chatId, message }) => {
          const cited = conversationOf(chatId);
          if (cited === null) {
            return (
              <p key={chatId} className={styles.deletedConversation} data-testid={chatAnswerTestIds.deletedConversation}>
                <StrokeIcon name="chat" size={14} />
                From a conversation you deleted
              </p>
            );
          }
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
        {sections === undefined && parts.length + stretches.length + others.length > 0 && (
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
            {others.map((citation, index) => (
              <ChatOtherOverviewCitation
                key={`${citation.overviewId}-${index}`}
                citation={citation}
                held={holdsOverview(citation.overviewId)}
                onFollowed={onOtherOverviewFollowed}
              />
            ))}
          </div>
        )}
        {actions?.(sourcesMenu)}
      </div>
    </SpokenSentenceProvider>
  );
};

const PLAIN: SpokenAnswerPlace = { part: "text" };
const INTRO: SpokenAnswerPlace = { part: "intro" };
const TAKEAWAY: SpokenAnswerPlace = { part: "takeaway" };

interface SpokenHeadingProps {
  text: string;
  place: SpokenAnswerPlace;
}

const SpokenHeading = ({ text, place }: SpokenHeadingProps) => {
  const spoken = useSpokenRange(place, 0);
  if (spoken === null) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, spoken.start)}
      <mark className={styles.spoken} data-spoken="">
        {text.slice(spoken.start, spoken.end)}
      </mark>
      {text.slice(spoken.end)}
    </>
  );
};

interface ChatItemTextProps {
  text: string;
  place: SpokenAnswerPlace;
}

const ChatItemText = ({ text, place }: ChatItemTextProps) => {
  const spoken = useSpokenRange(place, 0);
  if (!holdsCodeBlock(text)) {
    return <ChatMarkedText text={text} spoken={spoken} />;
  }
  return (
    <div className={styles.itemBlocks} data-testid={chatAnswerTestIds.itemBlocks}>
      <ChatAnswerText text={text} place={place} />
    </div>
  );
};

export interface ChatAnswerSectionsViewProps {
  sections: Pick<ChatAnswerSections, "intro" | "introSources" | "sections"> & { takeaway?: string };
  chipsOf?: ((cited: readonly ChatCitation[]) => ChatChip[]) | undefined;
}

export const ChatAnswerSectionsView = ({ sections, chipsOf }: ChatAnswerSectionsViewProps) => {
  const row = (cited: readonly ChatCitation[]) => {
    const chips = chipsOf?.(cited) ?? [];
    return <ChatChipRow chips={chips.map((each) => each.chip)} labels={chips.map((each) => each.label)} />;
  };
  const sourceRow = (sources: ChatAnswerSections["introSources"]) =>
    chipsOf === undefined || sources.length === 0 ? null : (
      <div className={styles.sectionSources} data-testid={chatAnswerTestIds.sectionSources}>
        {byRelation(sources).map(([relation, cited]) => (
          <div key={relation} className={styles.relation}>
            <p className={styles.relationLabel}>{relation}</p>
            {row(cited)}
          </div>
        ))}
      </div>
    );
  return (
    <>
      <ChatAnswerText text={sections.intro} place={INTRO} />
      {sourceRow(sections.introSources)}
      {sections.sections.map((section, index) => (
        <section key={index} className={styles.section} data-testid={chatAnswerTestIds.section}>
          <h3 className={styles.sectionHeading}>
            <SpokenHeading text={section.heading} place={{ part: "heading", section: index }} />
          </h3>
          {section.paragraphs.map((paragraph, at) => (
            <ChatAnswerText key={`p-${at}`} text={paragraph} place={{ part: "paragraph", section: index, paragraph: at }} />
          ))}
          {section.numbered.length > 0 && (
            <ol className={styles.list}>
              {section.numbered.map((item, at) => (
                <li key={at}>
                  <ChatItemText text={item.text} place={{ part: "numbered", section: index, item: at }} />
                  {chipsOf !== undefined && item.sources.length > 0 && (
                    <span className={styles.itemChips} data-testid={chatAnswerTestIds.itemSources}>
                      {row(item.sources)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {section.bullets.length > 0 && (
            <ul className={styles.list}>
              {section.bullets.map((item, at) => (
                <li key={at}>
                  <ChatItemText text={item.text} place={{ part: "bullet", section: index, item: at }} />
                  {chipsOf !== undefined && item.sources.length > 0 && (
                    <span className={styles.itemChips} data-testid={chatAnswerTestIds.itemSources}>
                      {row(item.sources)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {sourceRow(section.sources)}
        </section>
      ))}
      {sections.takeaway !== undefined && sections.takeaway !== "" && (
        <section className={styles.section} data-testid={chatAnswerTestIds.takeaway}>
          <h3 className={styles.sectionHeading}>Takeaway</h3>
          <ChatAnswerText text={sections.takeaway} place={TAKEAWAY} />
        </section>
      )}
    </>
  );
};

export interface ChatSourcesMenuProps {
  count: number;
  onOpened?: ((count: number) => void) | undefined;
  children: ReactNode;
}

export const ChatSourcesMenu = ({ count, onOpened, children }: ChatSourcesMenuProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  useDismissOnOutside(open, () => setOpen(false), menu, root);
  return (
    <div
      className={styles.sourcesHost}
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.sourcesButton}
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            onOpened?.(count);
          }
          setOpen(!open);
        }}
        data-testid={chatAnswerTestIds.sources}
      >
        Sources <span>{count}</span>
      </button>
      {open && (
        <div
          className={styles.sourcesMenu}
          ref={menu}
          role="group"
          aria-label={`Sources, ${count}`}
          data-testid={chatAnswerTestIds.sourcesMenu}
        >
          {children}
        </div>
      )}
    </div>
  );
};

interface ShowOnPageLinkProps {
  page: ChatPage;
  place: ArticlePlace;
}

const ShowOnPageLink = ({ page, place }: ShowOnPageLinkProps) => {
  if (page.onPage !== null) {
    const { onPage } = page;
    if (onPage.statusOf(place) === "missing") {
      return null;
    }
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
};
