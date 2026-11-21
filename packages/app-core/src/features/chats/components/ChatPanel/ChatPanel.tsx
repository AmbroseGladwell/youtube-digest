import { Fragment, forwardRef, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  sourceImage,
  FOLLOW_UP_QUESTIONS_SHOWN,
  MAX_CHAT_QUESTIONS,
  chatRecordId,
  chatSourceKind,
  type ChatMessage,
  type Overview,
  type TimeRange,
  type VideoSource,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useOnline } from "../../../../util/useOnline.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { resetDate } from "../../../newOverview/util/usageLine.js";
import { useChatUsageQuery } from "../../queries/chatUsageQuery.js";
import { useSlowAnswer } from "../../useSlowAnswer.js";
import { chatWaitCopy, type ShownWait } from "../../util/chatWaitCopy.js";
import { ChatWaitBlock } from "../ChatWaitBlock/ChatWaitBlock.js";
import type { AskState } from "../../useAskQuestion.js";
import type { useChatPanel } from "../../useChatPanel.js";
import { ARRIVING_ATTRIBUTE } from "../../util/bubbleTravel.js";
import { chatSuggestions } from "../../util/chatSuggestions.js";
import { chatWords, type ChatWords } from "../../util/chatWords.js";
import { streamedParagraphs } from "../../util/streamedParagraphs.js";
import { conversationDate, firstQuestionOf, questionsIn } from "../../util/conversationLine.js";
import { ChatAnswer, ChatAnswerSectionsView, type ChatAnswerProps, type ChatPage } from "../ChatAnswer/ChatAnswer.js";
import { ChatAnswerActions } from "../ChatAnswerActions/ChatAnswerActions.js";
import { ChatConversationList } from "../ChatConversationList/ChatConversationList.js";
import { ChatConversationMenu } from "../ChatConversationMenu/ChatConversationMenu.js";
import { ChatComposer } from "../ChatComposer/ChatComposer.js";
import { ChatDrewOn } from "../ChatDrewOn/ChatDrewOn.js";
import { ChatStreamedText } from "../ChatStreamedText/ChatStreamedText.js";
import styles from "./ChatPanel.module.scss";
import { chatPanelTestIds } from "./ChatPanelTestIds.js";

export interface ChatPanelProps {
  panel: ReturnType<typeof useChatPanel>;
  overview: Overview;
  video: VideoSource | null;
  // An article's or a recipe page's own page, for its links (OV-320); null for a video or episode.
  page: ChatPage | null;
  compact: boolean;
  onCitationFollowed: (range: TimeRange) => void;
  onOverviewPartFollowed: ChatAnswerProps["onOverviewPartFollowed"];
  onOpenTranscriptAt: (positionMs: number) => void;
}

const SAID_MS = 4000;
const OUTLINE_MS = 1600;

// The line under the field shows only when this few are left (design 310ab).
const FEW_LEFT = 10;

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;

const cited = (message: ChatMessage, kind: "startMs" | "part") =>
  message.from === "answer" ? message.citations.filter((each) => kind in each).length : 0;

// Said once an answer is final. One that cites the overview isn't a decline, though the source
// didn't cover it (319k), and on an article or a recipe page that is every answer (OV-320).
function announcementOf(message: ChatMessage, words: ChatWords): string {
  if (message.from !== "answer") return "";
  const moments = cited(message, "startMs");
  const parts = cited(message, "part");
  if (!message.inSource && parts === 0) return `${words.notCovered}: ${message.text}`;
  const citedLine = [
    moments === 0 ? null : plural(moments, "moment"),
    parts === 0 ? null : `${plural(parts, "part")} of the overview`,
  ].filter((line) => line !== null);
  return `Answer: ${message.text}${citedLine.length === 0 ? "" : ` ${citedLine.join(" and ")} cited.`}`;
}

// The reader's question a cited message belongs to: itself, or the question its answer answered.
const questionAt = (messages: readonly ChatMessage[], message: number) => (messages[message]?.from === "answer" ? message - 1 : message);

// Design 310a, 310i–310x: chat about one overview, beside its note. The conversation scrolls on
// its own above the field; the overview's questions sit just above the field until the reader
// types; an answer streams in under three dots, each word fading in, and is announced once, when final.
// The header's ⋯ holds the overview's other conversations and Continue in (design 324x).
export const ChatPanel = forwardRef<HTMLTextAreaElement, ChatPanelProps>(function ChatPanel(
  { panel, overview, video, page, compact, onCitationFollowed, onOverviewPartFollowed, onOpenTranscriptAt },
  fieldRef,
) {
  const { conversationId, chats, view, cameFrom, focusedMessage, deleting } = panel;
  const ask: AskState = panel.state;
  const [draft, setDraft] = useState("");
  const [set, setSet] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [said, setSaid] = useState<{ text: string; done: boolean; key: number } | null>(null);
  const [outlined, setOutlined] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const header = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const previous = useRef<AskState>({ status: "idle" });
  const now = new Date();
  const online = useOnline();
  const usage = useChatUsageQuery().data ?? null;
  const analytics = useAnalytics();

  const kind = chatSourceKind(overview);
  const words = chatWords(kind);
  const chatId = chatRecordId(overview.id, conversationId);
  const chat = chats.find((each) => each.id === chatId) ?? null;
  const messages = chat?.messages ?? [];
  const pending = ask.status !== "idle" && ask.status !== "waiting" && ask.conversationId === conversationId ? ask : null;
  const answering = pending?.status === "answering";
  const slowness = useSlowAnswer(answering, pending?.status === "answering" ? pending.text : "");
  const asked = messages.filter((message) => message.from === "reader").length;
  const full = asked >= MAX_CHAT_QUESTIONS;
  const left = usage === null ? null : Math.max(0, usage.limit - usage.used);
  const refused = ask.status === "waiting" && ask.wait.kind !== "noSource" ? ask.wait : null;
  const wait: ShownWait | null = !online
    ? { kind: "offline" }
    : full
      ? { kind: "conversationFull" }
      : refused !== null && (refused.kind !== "conversationFull" || pending !== null)
        ? refused
        : left === 0 && usage !== null
          ? { kind: "month", resetsOn: usage.resetsOn }
          : null;
  const others = chats.filter((each) => each !== chat).length;
  const questions = overview.followUpQuestions ?? [];
  const sets = Math.ceil(questions.length / FOLLOW_UP_QUESTIONS_SHOWN);
  const suggestions = draft.trim() !== "" || wait !== null || pending !== null ? [] : chatSuggestions(questions, set, messages);
  const firstQuestion = messages.find((message) => message.from === "reader")?.text ?? pending?.question ?? null;
  const latestAnswerAt = messages.map((message) => message.from).lastIndexOf("answer");
  const title = view === "list" ? "Conversations" : (firstQuestion ?? "New conversation");
  const about =
    view === "conversation" && cameFrom !== null && chat !== null
      ? `${conversationDate(chat.startedAt, now)} · ${plural(questionsIn(chat), "question")}`
      : `About ${overview.source.title}${full ? ` · ${asked} questions` : ""}`;

  const library = useOverviewsWithStateQuery().data;
  const overviewOf = (id: string) => {
    const entry = library?.find((each) => each.kind === "overview" && each.overview.id === id);
    return entry?.kind === "overview" ? entry.overview : null;
  };
  const imageOf = (id: string) => {
    const found = overviewOf(id);
    return { url: found === null ? null : sourceImage(found.source), wide: found?.source.kind === "youtube" };
  };
  const followSource = () => analytics.reader.chat.citationFollowed({ overviewId: overview.id, to: "otherOverview" });
  const holdsOverview = (overviewId: string) =>
    library === undefined || library.some((entry) => entry.kind === "overview" && entry.overview.id === overviewId);
  const conversationOf = (cited: string) => {
    const found = chats.find((each) => each.id === cited);
    return found === undefined ? null : { date: conversationDate(found.startedAt, now), firstQuestion: firstQuestionOf(found) };
  };

  useEffect(() => {
    const was = previous.current;
    previous.current = ask;
    if (ask.status === "answering" && was.status !== "answering") {
      setAnnouncement("Writing an answer");
      setArrivedAt(null);
    }
    if (ask.status === "stopped") setAnnouncement("Stopped");
    if (was.status === "answering" && ask.status === "idle" && was.conversationId === conversationId) {
      const answer = messages[latestAnswerAt];
      if (answer !== undefined) {
        setAnnouncement(announcementOf(answer, chatWords(kind)));
        setArrivedAt(latestAnswerAt);
      }
    }
  }, [ask, conversationId, messages, latestAnswerAt, kind]);

  // Each conversation opens scrolled to its latest answer, or to the message a citation named,
  // outlined for a moment with focus on it (design 310x).
  useEffect(() => {
    if (view !== "conversation") return;
    if (focusedMessage !== null) {
      const at = questionAt(messages, focusedMessage);
      const target = body.current?.querySelector<HTMLElement>(`[data-message="${at}"]`);
      if (target !== undefined && target !== null) {
        target.scrollIntoView({ block: "center" });
        target.focus({ preventScroll: true });
        setOutlined(at);
        const timer = setTimeout(() => setOutlined(null), OUTLINE_MS);
        return () => clearTimeout(timer);
      }
    }
    const element = body.current;
    if (element !== null) element.scrollTop = element.scrollHeight;
    return undefined;
  }, [view, conversationId, focusedMessage, messages.length, pending?.status, pending?.status === "answering" ? pending.text : null]);

  useEffect(() => {
    if (said === null) return;
    const timer = setTimeout(() => setSaid(null), SAID_MS);
    return () => clearTimeout(timer);
  }, [said]);

  useEffect(() => {
    setDraft("");
    setSet(0);
    setArrivedAt(null);
  }, [conversationId]);

  const say = (text: string, done: boolean) => setSaid({ text, done, key: Date.now() });

  const toast =
    deleting !== null ? (
      <div key={deleting.id} className={styles.toast} role="status" data-testid={chatPanelTestIds.toast}>
        <StrokeIcon name="check" size={17} />
        Conversation deleted
        <button type="button" className={styles.undo} onClick={panel.undoDelete} data-testid={chatPanelTestIds.undo}>
          Undo
        </button>
      </div>
    ) : said !== null ? (
      <div key={said.key} className={styles.toast} role="status" data-testid={chatPanelTestIds.toast}>
        <StrokeIcon name={said.done ? "check" : "alertCircle"} size={17} />
        {said.text}
      </div>
    ) : null;

  const send = (question: string, from: "question" | "typed") => {
    panel.ask(question.trim(), from);
    if (from === "typed") setDraft("");
  };

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    if (answering) panel.stop();
    else panel.close();
  };

  return (
    <section
      className={`${styles.root} ${compact ? styles.inSheet : ""}`}
      role={compact ? undefined : "complementary"}
      aria-label={compact ? undefined : `Ask about this ${words.noun}`}
      onKeyDown={keyDown}
      data-testid={chatPanelTestIds.root}
    >
      <header className={styles.header} ref={header} data-sheet-drag>
        <div className={styles.titles}>
          <p className={styles.title} data-testid={chatPanelTestIds.title}>
            {title}
          </p>
          <p className={styles.about} data-testid={chatPanelTestIds.about}>
            {about}
          </p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="New conversation"
          onClick={panel.newConversation}
          data-testid={chatPanelTestIds.newConversation}
        >
          <StrokeIcon name="pencil" size={16} />
        </button>
        {view === "conversation" && (
          <ChatConversationMenu
            chat={chat}
            overview={overview}
            conversations={chats.length}
            writing={answering}
            compact={compact}
            header={header}
            onOpenList={panel.openList}
            onSaid={say}
            searchLibrary={panel.searchLibrary}
            onSearchLibrary={(on) => {
              panel.setSearchLibrary(on);
              analytics.reader.chat.searchLibrarySwitched({ overviewId: overview.id, on });
            }}
          />
        )}
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={panel.close} data-testid={chatPanelTestIds.close}>
          <StrokeIcon name="close" size={16} />
        </button>
      </header>

      <div className={styles.body} ref={body} data-testid={chatPanelTestIds.body}>
        {view === "list" ? (
          <ChatConversationList
            chats={chats}
            openChatId={chat === null ? null : chat.id}
            now={now}
            onNew={panel.newConversation}
            onOpen={panel.openConversation}
            onDelete={panel.deleteConversation}
          />
        ) : messages.length === 0 && pending === null ? (
          <div className={styles.empty} data-testid={chatPanelTestIds.empty}>
            <p className={styles.emptyHeading}>What would you like to know about this {words.noun}?</p>
            <p className={styles.emptyLine}>
              {words.answersFrom}
              {others > 0 && ` It can see your ${plural(others, "other conversation")} about it.`}
            </p>
          </div>
        ) : (
          <>
            {cameFrom !== null && (
              <button type="button" className={styles.back} onClick={panel.goBack} data-testid={chatPanelTestIds.back}>
                <StrokeIcon name="chevronLeft" size={15} />
                Back to “{cameFrom.title}”
              </button>
            )}
            <ol className={styles.messages}>
              {messages.map((message, index) =>
                message.from === "reader" ? (
                  <Fragment key={index}>
                    <ChatDrewOn
                      how="pinned"
                      sources={(message.sources ?? []).filter((source) => source.how === "pinned")}
                      overviewOf={overviewOf}
                      onFollow={followSource}
                    />
                    <li
                      className={`${styles.question} ${outlined === index ? styles.outlined : ""}`}
                      tabIndex={-1}
                      data-message={index}
                      data-testid={chatPanelTestIds.question}
                    >
                      {message.text}
                    </li>
                    <ChatDrewOn
                      how="found"
                      sources={(message.sources ?? []).filter((source) => source.how === "found")}
                      overviewOf={overviewOf}
                      onFollow={followSource}
                    />
                  </Fragment>
                ) : (
                  <li
                    key={index}
                    data-message={index}
                    data-answer=""
                    {...(revealed === index ? { "data-revealed": "" } : {})}
                    onClick={() => setRevealed(index)}
                  >
                    <ChatAnswer
                      text={message.text}
                      inSource={message.inSource}
                      citations={message.citations}
                      about={kind}
                      arrived={index === arrivedAt}
                      page={page}
                      video={video}
                      overview={overview}
                      onCitationFollowed={onCitationFollowed}
                      onOverviewPartFollowed={onOverviewPartFollowed}
                      onOpenTranscriptAt={onOpenTranscriptAt}
                      conversationOf={conversationOf}
                      onConversationFollowed={(cited, at) =>
                        panel.followConversation(cited, at, { title: firstQuestion ?? "", message: index })
                      }
                      holdsOverview={holdsOverview}
                      onOtherOverviewFollowed={(cited) =>
                        analytics.reader.chat.citationFollowed({
                          overviewId: overview.id,
                          to: "otherOverview",
                          ...(cited.item === null ? {} : { part: cited.item.part, index: cited.item.index }),
                        })
                      }
                      sections={message.sections}
                      imageOf={imageOf}
                      onSourcesOpened={(sources) => analytics.reader.chat.sourcesMenuOpened({ overviewId: overview.id, sources })}
                      actions={(sources) => (
                        <ChatAnswerActions
                          overviewId={overview.id}
                          answer={message.text}
                          latest={index === latestAnswerAt && pending === null}
                          onSaid={say}
                          sources={sources}
                        />
                      )}
                    />
                  </li>
                ),
              )}
              {pending !== null && (
                <>
                  {pending.status === "answering" && pending.sources !== null && (
                    <ChatDrewOn how="pinned" sources={pending.sources.pinned} overviewOf={overviewOf} onFollow={followSource} />
                  )}
                  <li
                    className={styles.question}
                    {...(pending.status === "answering" ? { [ARRIVING_ATTRIBUTE]: "" } : {})}
                    data-testid={chatPanelTestIds.question}
                  >
                    {pending.question}
                  </li>
                  {pending.status === "answering" && pending.sources !== null && (
                    <ChatDrewOn how="found" sources={pending.sources.found} overviewOf={overviewOf} onFollow={followSource} />
                  )}
                  <li data-testid={chatPanelTestIds.pending}>
                    {(pending.status === "answering" || pending.status === "stopped") && (
                      <div className={styles.streaming} aria-busy={pending.status === "answering"}>
                        {pending.status === "answering" && streamedParagraphs(pending.text, false).length === 0 ? (
                          <span className={styles.dots} aria-hidden="true" data-testid={chatPanelTestIds.dots}>
                            <span />
                            <span />
                            <span />
                          </span>
                        ) : (
                          <ChatStreamedText text={pending.text} whole={pending.status === "stopped"} />
                        )}
                        {pending.status === "answering" && pending.sections.length > 0 && (
                          <div data-testid={chatPanelTestIds.streamedSections}>
                            <ChatAnswerSectionsView
                              sections={{ intro: "", introSources: [], sections: pending.sections }}
                              sourceRow={() => null}
                            />
                          </div>
                        )}
                        {slowness === "noWordsYet" && (
                          <p className={styles.status} data-testid={chatPanelTestIds.slow}>
                            Still working on it…
                          </p>
                        )}
                        {slowness === "stalled" && (
                          <p className={styles.status} data-testid={chatPanelTestIds.slow}>
                            <StrokeIcon name="wifiOff" size={14} />
                            Connection is slow. It’ll carry on when it catches up.
                          </p>
                        )}
                        {pending.status === "stopped" && (
                          <p className={styles.status} data-testid={chatPanelTestIds.stopped}>
                            Stopped. This one didn’t count.
                          </p>
                        )}
                      </div>
                    )}
                    {pending.status === "failed" && (
                      <div className={styles.failure} role="alert" data-testid={chatPanelTestIds.failure}>
                        <p>Something went wrong answering that. Try again in a while.</p>
                        <button
                          type="button"
                          className={styles.pillButton}
                          onClick={() => panel.ask(pending.question, "typed")}
                          data-testid={chatPanelTestIds.tryAgain}
                        >
                          <StrokeIcon name="rotateCw" size={15} />
                          Try again
                        </button>
                      </div>
                    )}
                  </li>
                </>
              )}
            </ol>
          </>
        )}
      </div>

      {view === "list" && usage !== null && left !== null && (
        <p className={`${styles.left} ${styles.listFoot}`} data-testid={chatPanelTestIds.left}>
          {left} of {usage.limit.toLocaleString("en-GB")} questions left this month, on us. More on {resetDate(usage.resetsOn)}.
        </p>
      )}
      {view === "conversation" && (
        <div className={styles.foot}>
          {toast !== null && <div className={styles.toastSpot}>{toast}</div>}
          {suggestions.length > 0 && (
            <div className={styles.suggestions} data-testid={chatPanelTestIds.suggestions}>
              <div className={styles.suggestionsHead}>
                <p className={styles.suggestionsLabel}>Questions to ask next</p>
                {sets > 1 && (
                  <button
                    type="button"
                    className={styles.different}
                    aria-label={`Different questions, ${set + 1} of ${sets}`}
                    onClick={() => setSet((set + 1) % sets)}
                    data-testid={chatPanelTestIds.differentQuestions}
                  >
                    <StrokeIcon name="rotateCw" size={15} />
                    Different questions
                  </button>
                )}
              </div>
              <ul className={styles.suggestionList}>
                {suggestions.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      className={styles.suggestion}
                      disabled={answering}
                      onClick={() => send(question, "question")}
                      data-testid={chatPanelTestIds.suggestion}
                    >
                      <StrokeIcon name="arrowRight" size={15} />
                      <span>{question}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {wait !== null ? (
            <ChatWaitBlock
              copy={chatWaitCopy(wait, usage?.plan ?? "free", usage?.resetsOn ?? null)}
              onNewConversation={panel.newConversation}
              onPlansFollowed={() => analytics.reader.chat.plansFollowed({ overviewId: overview.id })}
            />
          ) : (
            <ChatComposer
              ref={fieldRef}
              overviewId={overview.id}
              pinned={panel.pinned}
              liveSources={panel.liveSources}
              onPin={panel.pin}
              onUnpin={panel.unpin}
              onRemoveSource={panel.removeSource}
              onClear={panel.clearSources}
              value={draft}
              placeholder={`Ask about this ${words.noun}`}
              answering={answering}
              onChange={setDraft}
              onSend={() => send(draft, "typed")}
              onStop={panel.stop}
            />
          )}
          {wait === null && left !== null && left > 0 && left <= FEW_LEFT && (
            <p className={styles.left} data-testid={chatPanelTestIds.left}>
              <b>{left}</b> {left === 1 ? "question" : "questions"} left this month, on us
            </p>
          )}
        </div>
      )}

      <p className={styles.live} aria-live="polite" data-testid={chatPanelTestIds.announcement}>
        {announcement}
      </p>
      {view === "list" && toast}
    </section>
  );
});
