import { forwardRef, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  FOLLOW_UP_QUESTIONS_SHOWN,
  chatRecordId,
  type Chat,
  type ChatMessage,
  type Overview,
  type TimeRange,
  type VideoSource,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { AskedFrom, AskState } from "../../useAskQuestion.js";
import { chatSuggestions } from "../../util/chatSuggestions.js";
import { ChatAnswer } from "../ChatAnswer/ChatAnswer.js";
import { ChatAnswerActions } from "../ChatAnswerActions/ChatAnswerActions.js";
import { ChatField } from "../ChatField/ChatField.js";
import styles from "./ChatPanel.module.scss";
import { chatPanelTestIds } from "./ChatPanelTestIds.js";

export interface ChatPanelProps {
  overview: Overview;
  video: VideoSource | null;
  conversationId: string;
  chats: readonly Chat[];
  ask: AskState;
  compact: boolean;
  onAsk: (question: string, from: AskedFrom) => void;
  onStop: () => void;
  onNewConversation: () => void;
  onClose: () => void;
  onCitationFollowed: (range: TimeRange) => void;
  onOpenTranscriptAt: (positionMs: number) => void;
}

const SAID_MS = 4000;

const WAIT_HEADINGS = {
  month: "You’ve asked this month’s questions on us",
  day: "That’s the most questions for one day",
  everyone: "Questions are paused for everyone today",
  conversationFull: "This conversation has 50 questions, the most one can hold.",
  noSource: "",
} as const;

const citedMoments = (message: ChatMessage) =>
  message.from === "answer" ? message.citations.filter((each) => "startMs" in each).length : 0;

function announcementOf(message: ChatMessage, sourceWord: string): string {
  if (message.from !== "answer") return "";
  if (!message.inSource) return `Not in the ${sourceWord}: ${message.text}`;
  const moments = citedMoments(message);
  return `Answer: ${message.text}${moments === 0 ? "" : ` ${moments} ${moments === 1 ? "moment" : "moments"} cited.`}`;
}

// Design 310a, 310i–310p: chat about one overview, beside its note. The conversation scrolls on
// its own above the field; the overview's questions sit just above the field until the reader
// types; an answer streams in under three dots, then a caret, and is announced once, when final.
export const ChatPanel = forwardRef<HTMLTextAreaElement, ChatPanelProps>(function ChatPanel(
  {
    overview,
    video,
    conversationId,
    chats,
    ask,
    compact,
    onAsk,
    onStop,
    onNewConversation,
    onClose,
    onCitationFollowed,
    onOpenTranscriptAt,
  },
  fieldRef,
) {
  const [draft, setDraft] = useState("");
  const [set, setSet] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [said, setSaid] = useState<{ text: string; done: boolean; key: number } | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const previous = useRef<AskState>({ status: "idle" });

  const sourceWord = overview.source.kind === "podcast" ? "episode" : "video";
  const chat = chats.find((each) => each.id === chatRecordId(overview.id, conversationId)) ?? null;
  const messages = chat?.messages ?? [];
  const pending = ask.status !== "idle" && ask.conversationId === conversationId ? ask : null;
  const answering = pending?.status === "answering";
  const others = chats.filter((each) => each !== chat).length;
  const questions = overview.followUpQuestions ?? [];
  const sets = Math.ceil(questions.length / FOLLOW_UP_QUESTIONS_SHOWN);
  const suggestions = draft.trim() !== "" || pending?.status === "waiting" ? [] : chatSuggestions(questions, set, messages);
  const firstQuestion = messages.find((message) => message.from === "reader")?.text ?? pending?.question ?? null;
  const latestAnswerAt = messages.map((message) => message.from).lastIndexOf("answer");

  useEffect(() => {
    const was = previous.current;
    previous.current = ask;
    if (ask.status === "answering" && was.status !== "answering") setAnnouncement("Writing an answer");
    if (ask.status === "stopped") setAnnouncement("Stopped");
    if (was.status === "answering" && ask.status === "idle" && was.conversationId === conversationId) {
      const answer = messages[messages.map((message) => message.from).lastIndexOf("answer")];
      if (answer !== undefined) setAnnouncement(announcementOf(answer, sourceWord));
    }
  }, [ask, conversationId, messages, sourceWord]);

  useEffect(() => {
    const element = body.current;
    if (element !== null) element.scrollTop = element.scrollHeight;
  }, [messages.length, pending?.status, pending?.status === "answering" ? pending.text : null]);

  useEffect(() => {
    if (said === null) return;
    const timer = setTimeout(() => setSaid(null), SAID_MS);
    return () => clearTimeout(timer);
  }, [said]);

  useEffect(() => {
    setDraft("");
    setSet(0);
  }, [conversationId]);

  const send = (question: string, from: AskedFrom) => {
    onAsk(question.trim(), from);
    if (from === "typed") setDraft("");
  };

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    if (answering) onStop();
    else onClose();
  };

  return (
    <section
      className={styles.root}
      role="complementary"
      aria-label={`Ask about this ${sourceWord}`}
      onKeyDown={keyDown}
      data-testid={chatPanelTestIds.root}
    >
      <header className={styles.header}>
        <div className={styles.titles}>
          <p className={styles.title} data-testid={chatPanelTestIds.title}>
            {firstQuestion ?? "New conversation"}
          </p>
          <p className={styles.about}>About {overview.source.title}</p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="New conversation"
          onClick={onNewConversation}
          data-testid={chatPanelTestIds.newConversation}
        >
          <StrokeIcon name="pencil" size={16} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose} data-testid={chatPanelTestIds.close}>
          <StrokeIcon name="close" size={16} />
        </button>
      </header>

      <div className={styles.body} ref={body} data-testid={chatPanelTestIds.body}>
        {messages.length === 0 && pending === null ? (
          <div className={styles.empty} data-testid={chatPanelTestIds.empty}>
            <p className={styles.emptyHeading}>What would you like to know about this {sourceWord}?</p>
            <p className={styles.emptyLine}>
              Answers come from the {sourceWord}, with the moments they’re from.
              {others > 0 && ` It can see your ${others} other ${others === 1 ? "conversation" : "conversations"} about it.`}
            </p>
          </div>
        ) : (
          <ol className={styles.messages}>
            {messages.map((message, index) =>
              message.from === "reader" ? (
                <li key={index} className={styles.question} data-testid={chatPanelTestIds.question}>
                  {message.text}
                </li>
              ) : (
                <li key={index}>
                  <ChatAnswer
                    text={message.text}
                    inSource={message.inSource}
                    citations={message.citations}
                    sourceWord={sourceWord}
                    video={video}
                    onCitationFollowed={onCitationFollowed}
                    onOpenTranscriptAt={onOpenTranscriptAt}
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
                <li className={styles.question} data-testid={chatPanelTestIds.question}>
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
                        onClick={() => onAsk(pending.question, "typed")}
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
        )}
      </div>

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
        {pending?.status === "waiting" ? (
          <div className={styles.wait} role="status" data-testid={chatPanelTestIds.wait}>
            <StrokeIcon name="clock" size={18} />
            {WAIT_HEADINGS[pending.wait.kind]}
          </div>
        ) : (
          <ChatField
            ref={fieldRef}
            value={draft}
            placeholder={`Ask about this ${sourceWord}`}
            answering={answering}
            onChange={setDraft}
            onSend={() => send(draft, "typed")}
            onStop={onStop}
          />
        )}
      </div>

      <p className={styles.live} aria-live="polite" data-testid={chatPanelTestIds.announcement}>
        {announcement}
      </p>
      {said !== null && (
        <div key={said.key} className={styles.toast} role="status" data-testid={chatPanelTestIds.toast}>
          <StrokeIcon name={said.done ? "check" : "alertCircle"} size={17} />
          {said.text}
        </div>
      )}
    </section>
  );
});
