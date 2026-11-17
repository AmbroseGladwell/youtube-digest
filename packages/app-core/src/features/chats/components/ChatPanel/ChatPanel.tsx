import { forwardRef, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  FOLLOW_UP_QUESTIONS_SHOWN,
  MAX_CHAT_QUESTIONS,
  chatRecordId,
  type ChatMessage,
  type Overview,
  type TimeRange,
  type VideoSource,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useOnline } from "../../../../util/useOnline.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { resetDate } from "../../../newOverview/util/usageLine.js";
import { useChatUsageQuery } from "../../queries/chatUsageQuery.js";
import { useSlowAnswer } from "../../useSlowAnswer.js";
import { chatWaitCopy, type ShownWait } from "../../util/chatWaitCopy.js";
import { ChatWaitBlock } from "../ChatWaitBlock/ChatWaitBlock.js";
import type { AskState } from "../../useAskQuestion.js";
import type { useChatPanel } from "../../useChatPanel.js";
import { ARRIVING_ATTRIBUTE } from "../../util/bubbleTravel.js";
import { chatSuggestions } from "../../util/chatSuggestions.js";
import { conversationDate, firstQuestionOf, questionsIn } from "../../util/conversationLine.js";
import { ChatAnswer } from "../ChatAnswer/ChatAnswer.js";
import { ChatAnswerActions } from "../ChatAnswerActions/ChatAnswerActions.js";
import { ChatConversationList } from "../ChatConversationList/ChatConversationList.js";
import { ChatField } from "../ChatField/ChatField.js";
import styles from "./ChatPanel.module.scss";
import { chatPanelTestIds } from "./ChatPanelTestIds.js";

export interface ChatPanelProps {
  panel: ReturnType<typeof useChatPanel>;
  overview: Overview;
  video: VideoSource | null;
  compact: boolean;
  onCitationFollowed: (range: TimeRange) => void;
  onOpenTranscriptAt: (positionMs: number) => void;
}

const SAID_MS = 4000;
const OUTLINE_MS = 1600;

// The line under the field shows only when this few are left (design 310ab).
const FEW_LEFT = 10;

const citedMoments = (message: ChatMessage) =>
  message.from === "answer" ? message.citations.filter((each) => "startMs" in each).length : 0;

function announcementOf(message: ChatMessage, sourceWord: string): string {
  if (message.from !== "answer") return "";
  if (!message.inSource) return `Not in the ${sourceWord}: ${message.text}`;
  const moments = citedMoments(message);
  return `Answer: ${message.text}${moments === 0 ? "" : ` ${moments} ${moments === 1 ? "moment" : "moments"} cited.`}`;
}

// The reader's question a cited message belongs to: itself, or the question its answer answered.
const questionAt = (messages: readonly ChatMessage[], message: number) => (messages[message]?.from === "answer" ? message - 1 : message);

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;

// Design 310a, 310i–310x: chat about one overview, beside its note. The conversation scrolls on
// its own above the field; the overview's questions sit just above the field until the reader
// types; an answer streams in under three dots, then a caret, and is announced once, when final.
// The header's count opens the overview's conversations.
export const ChatPanel = forwardRef<HTMLTextAreaElement, ChatPanelProps>(function ChatPanel(
  { panel, overview, video, compact, onCitationFollowed, onOpenTranscriptAt },
  fieldRef,
) {
  const { conversationId, chats, view, cameFrom, focusedMessage, deleting } = panel;
  const ask: AskState = panel.state;
  const [draft, setDraft] = useState("");
  const [set, setSet] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [said, setSaid] = useState<{ text: string; done: boolean; key: number } | null>(null);
  const [outlined, setOutlined] = useState<number | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const previous = useRef<AskState>({ status: "idle" });
  const now = new Date();
  const online = useOnline();
  const usage = useChatUsageQuery().data ?? null;
  const analytics = useAnalytics();

  const sourceWord = overview.source.kind === "podcast" ? "episode" : "video";
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
  const suggestions =
    draft.trim() !== "" || wait !== null
      ? []
      : chatSuggestions(questions, set, messages).filter((question) => question !== pending?.question);
  const firstQuestion = messages.find((message) => message.from === "reader")?.text ?? pending?.question ?? null;
  const latestAnswerAt = messages.map((message) => message.from).lastIndexOf("answer");
  const title = view === "list" ? "Conversations" : (firstQuestion ?? "New conversation");
  const about =
    view === "conversation" && cameFrom !== null && chat !== null
      ? `${conversationDate(chat.startedAt, now)} · ${plural(questionsIn(chat), "question")}`
      : `About ${overview.source.title}${full ? ` · ${asked} questions` : ""}`;

  const conversationOf = (cited: string) => {
    const found = chats.find((each) => each.id === cited);
    return found === undefined ? null : { date: conversationDate(found.startedAt, now), firstQuestion: firstQuestionOf(found) };
  };

  useEffect(() => {
    const was = previous.current;
    previous.current = ask;
    if (ask.status === "answering" && was.status !== "answering") setAnnouncement("Writing an answer");
    if (ask.status === "stopped") setAnnouncement("Stopped");
    if (was.status === "answering" && ask.status === "idle" && was.conversationId === conversationId) {
      const answer = messages[latestAnswerAt];
      if (answer !== undefined) setAnnouncement(announcementOf(answer, sourceWord));
    }
  }, [ask, conversationId, messages, latestAnswerAt, sourceWord]);

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
  }, [conversationId]);

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
      aria-label={compact ? undefined : `Ask about this ${sourceWord}`}
      onKeyDown={keyDown}
      data-testid={chatPanelTestIds.root}
    >
      <header className={styles.header} data-sheet-drag>
        <div className={styles.titles}>
          <p className={styles.title} data-testid={chatPanelTestIds.title}>
            {title}
          </p>
          <p className={styles.about} data-testid={chatPanelTestIds.about}>
            {about}
          </p>
        </div>
        {view === "conversation" && chats.length > 0 && (
          <button
            type="button"
            className={styles.count}
            aria-label={`Conversations, ${chats.length}`}
            onClick={panel.openList}
            data-testid={chatPanelTestIds.count}
          >
            <StrokeIcon name="chat" size={16} />
            {chats.length}
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          aria-label="New conversation"
          onClick={panel.newConversation}
          data-testid={chatPanelTestIds.newConversation}
        >
          <StrokeIcon name="pencil" size={16} />
        </button>
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
            <p className={styles.emptyHeading}>What would you like to know about this {sourceWord}?</p>
            <p className={styles.emptyLine}>
              Answers come from the {sourceWord}, with the moments they’re from.
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
                  <li
                    key={index}
                    className={`${styles.question} ${outlined === index ? styles.outlined : ""}`}
                    tabIndex={-1}
                    data-message={index}
                    data-testid={chatPanelTestIds.question}
                  >
                    {message.text}
                  </li>
                ) : (
                  <li key={index} data-message={index}>
                    <ChatAnswer
                      text={message.text}
                      inSource={message.inSource}
                      citations={message.citations}
                      sourceWord={sourceWord}
                      video={video}
                      onCitationFollowed={onCitationFollowed}
                      onOpenTranscriptAt={onOpenTranscriptAt}
                      conversationOf={conversationOf}
                      onConversationFollowed={(cited, at) =>
                        panel.followConversation(cited, at, { title: firstQuestion ?? "", message: index })
                      }
                      actions={
                        index === latestAnswerAt && pending === null && chat !== null ? (
                          <ChatAnswerActions
                            chat={chat}
                            overview={overview}
                            answer={message.text}
                            compact={compact}
                            onSaid={(text, done) => setSaid({ text, done, key: Date.now() })}
                          />
                        ) : undefined
                      }
                    />
                  </li>
                ),
              )}
              {pending !== null && (
                <>
                  <li
                    className={styles.question}
                    {...(pending.status === "answering" ? { [ARRIVING_ATTRIBUTE]: "" } : {})}
                    data-testid={chatPanelTestIds.question}
                  >
                    {pending.question}
                  </li>
                  <li data-testid={chatPanelTestIds.pending}>
                    {(pending.status === "answering" || pending.status === "stopped") && (
                      <div className={styles.streaming} aria-busy={pending.status === "answering"}>
                        {pending.text === "" && pending.status === "answering" ? (
                          <span className={styles.dots} aria-hidden="true" data-testid={chatPanelTestIds.dots}>
                            <span />
                            <span />
                            <span />
                          </span>
                        ) : (
                          <p className={styles.streamedText} data-testid={chatPanelTestIds.streamedText}>
                            {pending.text}
                            {pending.status === "answering" && <span className={styles.caret} aria-hidden="true" />}
                          </p>
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
          {suggestions.length > 0 && (
            <div className={styles.suggestions} data-testid={chatPanelTestIds.suggestions}>
              <div className={styles.suggestionsHead}>
                <p className={styles.suggestionsLabel}>Questions to ask next</p>
                {sets > 1 && !messages.some((message) => message.from === "answer") && (
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
            <ChatField
              ref={fieldRef}
              value={draft}
              placeholder={`Ask about this ${sourceWord}`}
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
      {deleting !== null ? (
        <div key={deleting.id} className={styles.toast} role="status" data-testid={chatPanelTestIds.toast}>
          <StrokeIcon name="check" size={17} />
          Conversation deleted
          <button type="button" className={styles.undo} onClick={panel.undoDelete} data-testid={chatPanelTestIds.undo}>
            Undo
          </button>
        </div>
      ) : (
        said !== null && (
          <div key={said.key} className={styles.toast} role="status" data-testid={chatPanelTestIds.toast}>
            <StrokeIcon name={said.done ? "check" : "alertCircle"} size={17} />
            {said.text}
          </div>
        )
      )}
    </section>
  );
});
