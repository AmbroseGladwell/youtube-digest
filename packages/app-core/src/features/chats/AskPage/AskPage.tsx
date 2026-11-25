import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { MAX_CHAT_QUESTIONS, ProjectId, sourceImage, type ChatMessage, type ChatUsage, type Overview } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { useOnline } from "../../../util/useOnline.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import { useProjectMembersQuery } from "../../projects/queries/projectMembersQuery.js";
import { useProjectsQuery } from "../../projects/queries/projectsQuery.js";
import { isConnected } from "../../sync/types/SyncConnection.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { AskAnswer } from "../components/AskAnswer/AskAnswer.js";
import { AskDrawer } from "../components/AskDrawer/AskDrawer.js";
import { AskPickingWait } from "../components/AskPickingWait/AskPickingWait.js";
import { ChatAnswerActions } from "../components/ChatAnswerActions/ChatAnswerActions.js";
import { ChatAnswerSectionsView } from "../components/ChatAnswer/ChatAnswer.js";
import { ChatComposer } from "../components/ChatComposer/ChatComposer.js";
import { ChatDrewOn } from "../components/ChatDrewOn/ChatDrewOn.js";
import { ChatStreamedText } from "../components/ChatStreamedText/ChatStreamedText.js";
import { ChatWaitBlock } from "../components/ChatWaitBlock/ChatWaitBlock.js";
import { AskQuestionCards } from "../components/AskQuestionCards/AskQuestionCards.js";
import { useChatUsageQuery } from "../queries/chatUsageQuery.js";
import { useAskPage } from "../useAskPage.js";
import { useSuggestedQuestions, type QuestionRemoval } from "../useSuggestedQuestions.js";
import type { AskQuestion } from "../types/AskQuestion.js";
import type { PickedOverview } from "../useAskOver.js";
import { askStarters } from "../util/askStarters.js";
import { chatWaitCopy, type ShownWait } from "../util/chatWaitCopy.js";
import { chatMeterOf, chatMeterStateOf, spentWaitOf } from "../util/chatMeterOf.js";
import { useChatMeterShown } from "../useChatMeterShown.js";
import { ChatMeterLine } from "../components/ChatMeterLine/ChatMeterLine.js";
import { prefersReducedMotion } from "../../../util/prefersReducedMotion.js";
import styles from "./AskPage.module.scss";
import { askPageTestIds } from "./AskPageTestIds.js";

const SAID_MS = 3000;

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// Matches --motion-travel, the drawer's slide.
const DRAWER_MOTION_MS = 260;

interface WaitFacts {
  online: boolean;
  asked: number;
  refused: ShownWait | null;
  usage: ChatUsage | null;
}

const waitOf = ({ online, asked, refused, usage }: WaitFacts): ShownWait | null => {
  if (!online) {
    return { kind: "offline" };
  }
  if (asked >= MAX_CHAT_QUESTIONS) {
    return { kind: "conversationFull" };
  }
  if (refused !== null) {
    return refused;
  }
  return spentWaitOf(usage, "library");
};

const placeholderOf = (isPhone: boolean, scope: "library" | "project"): string => {
  if (isPhone) {
    return "Ask or @ to add sources";
  }
  return scope === "project" ? "Ask about this project or @ to add sources" : "Ask your library or @ to add sources";
};

const drawerMotionOf = (open: boolean, arrives: boolean): "arriving" | "still" | "leaving" => {
  if (!open) {
    return "leaving";
  }
  return arrives ? "arriving" : "still";
};

const REMOVAL_TOAST: Record<QuestionRemoval, string> = {
  notUseful: "Thanks. We won’t suggest it again.",
  hidden: "Hidden.",
};

const pickingPhaseOf = (picking: "choosing" | "reading", text: string, sectionCount: number): "choosing" | "reading" | "read" => {
  if (picking === "choosing") {
    return "choosing";
  }
  return text === "" && sectionCount === 0 ? "reading" : "read";
};

export const AskPage = () => {
  const [params] = useSearchParams();
  const parsedProject = ProjectId.safeParse(params.get("project"));
  const projectId = parsedProject.success ? parsedProject.data : null;
  const page = useAskPage(projectId, params.get("chat"));
  const { connection } = useSyncConnection();
  const analytics = useAnalytics();
  const isPhone = useIsPhone();
  const online = useOnline();
  const usage = useChatUsageQuery().data ?? null;
  const projects = useProjectsQuery().data ?? [];
  const members = useProjectMembersQuery().data ?? [];
  const topics = useTopicsQuery().data ?? [];
  const library = useOverviewsWithStateQuery().data;
  const [draft, setDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(() => !isPhone);
  const [drawerLeaving, setDrawerLeaving] = useState(false);
  const [drawerArrives, setDrawerArrives] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [said, setSaid] = useState<{ text: string; done: boolean; key: number } | null>(null);
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const drawerButton = useRef<HTMLButtonElement | null>(null);
  const opened = useRef(false);
  const now = new Date();

  const showDrawer = () => {
    analytics.ask.drawer.opened();
    setDrawerLeaving(false);
    setDrawerArrives(!prefersReducedMotion());
    setDrawerOpen(true);
  };
  const hideDrawer = () => {
    setDrawerOpen(false);
    setDrawerLeaving(!prefersReducedMotion());
  };
  useEffect(() => {
    if (!drawerLeaving) {
      return;
    }
    const timer = setTimeout(() => setDrawerLeaving(false), DRAWER_MOTION_MS);
    return () => clearTimeout(timer);
  }, [drawerLeaving]);

  const project = projectId === null ? null : (projects.find((each) => each.id === projectId) ?? null);
  const scope = page.scope;
  const entries = (library ?? []).flatMap((entry) =>
    entry.kind === "overview" ? [{ overview: entry.overview, read: entry.state.read }] : [],
  );
  const overviewOf = (id: string): Overview | null => entries.find((entry) => entry.overview.id === id)?.overview ?? null;
  const holds = (id: string) => library === undefined || overviewOf(id) !== null;
  const imageOf = (id: string) => {
    const found = overviewOf(id);
    return { url: found === null ? null : sourceImage(found.source), wide: found?.source.kind === "youtube" };
  };
  const pickedOf = (message: Extract<ChatMessage, { from: "reader" }>): PickedOverview[] =>
    (message.picked ?? []).map((overviewId) => ({ overviewId, title: overviewOf(overviewId)?.source.title ?? "An overview you deleted" }));
  const followed = () => analytics.ask.chat.overviewFollowed({ scope });

  const messages = page.chat?.messages ?? [];
  const state = page.state;
  const pending = state.status !== "idle" && state.status !== "waiting" && state.conversationId === page.conversationId ? state : null;
  const answering = pending?.status === "answering";
  const asked = messages.filter((message) => message.from === "reader").length;
  const refused = state.status === "waiting" && state.wait.kind !== "noSource" ? state.wait : null;
  const wait = waitOf({ online, asked, refused, usage });
  const meter = chatMeterOf(usage);
  useChatMeterShown(chatMeterStateOf(wait?.kind ?? null, meter), (state) =>
    analytics.ask.chat.meterShown({ scope, state, plan: usage?.plan ?? "free" }),
  );
  const empty = messages.length === 0 && pending === null;
  const latestAnswerAt = messages.map((message) => message.from).lastIndexOf("answer");
  const starters = empty ? askStarters({ overviews: entries, projects, members, topics }, project) : [];
  const offline = wait?.kind === "offline";
  const questionsShowing = empty && (wait === null || offline);
  const suggestions = useSuggestedQuestions({ projectId, templates: starters, showing: questionsShowing });
  const templatesOnly = !suggestions.canCycle && suggestions.questions.every((question) => question.kind === "template");

  useEffect(() => {
    if (opened.current) {
      return;
    }
    opened.current = true;
    analytics.ask.page.opened({ from: projectId === null ? "topBar" : "project", scope });
  }, [analytics, projectId, scope]);

  useEffect(() => {
    setDraft("");
    setArrivedAt(null);
  }, [page.conversationId]);

  useEffect(() => {
    if (said === null) {
      return;
    }
    const timer = setTimeout(() => setSaid(null), SAID_MS);
    return () => clearTimeout(timer);
  }, [said]);

  // Each step announced once; the titles are never read out one by one (page 3).
  const previous = useRef(state);
  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (state.status === "answering") {
      const wasPicking = was.status === "answering" ? was.picking : null;
      if (state.picking === "choosing" && wasPicking !== "choosing") {
        setAnnouncement("Choosing which overviews to read");
      } else if (state.picking === "reading" && wasPicking !== "reading") {
        setAnnouncement(
          state.looked === undefined ? `Reading ${overviews(state.picked.length)}` : `Looking across ${overviews(state.looked)}`,
        );
      } else if (was.status !== "answering" && state.picking === null) {
        setAnnouncement("Writing an answer");
      }
    }
    if (state.status === "stopped") {
      setAnnouncement("Stopped");
    }
    if (was.status === "answering" && state.status === "idle") {
      setAnnouncement("Answer ready");
      setArrivedAt(latestAnswerAt);
    }
  }, [state, latestAnswerAt]);

  // Scrolled once to the latest question, so the answer reads down from it and isn't followed (OV-362).
  const asking = pending?.status === "answering" ? pending.question : null;
  useEffect(() => {
    const questions = document.querySelectorAll<HTMLElement>(`[data-testid="${askPageTestIds.question}"]`);
    questions[questions.length - 1]?.scrollIntoView({ block: "start" });
  }, [asking, page.conversationId]);

  if (!isConnected(connection)) {
    return (
      <main className={styles.root} data-testid={askPageTestIds.root}>
        <div className={styles.signedOut} data-testid={askPageTestIds.signedOut}>
          <p>Sign in to ask across everything you&rsquo;ve saved.</p>
          <PageLink className={styles.pill} to={Routes.signIn()}>
            Sign in
          </PageLink>
        </div>
      </main>
    );
  }

  const say = (text: string, done: boolean) => setSaid({ text, done, key: Date.now() });
  const send = (question: string) => {
    page.ask(question, "typed");
    setDraft("");
  };
  const askSuggested = (question: AskQuestion) => {
    if (offline) {
      return;
    }
    const asked = suggestions.ask(question);
    page.ask(asked.text, "starter", asked.pinnedOverviews);
  };

  const toastFor = (): ReactNode => {
    if (page.deleting !== null) {
      return (
        <div key={page.deleting.id} className={styles.toast} role="status" data-testid={askPageTestIds.toast}>
          <StrokeIcon name="check" size={17} />
          Conversation deleted
          <button type="button" className={styles.undo} onClick={page.undoDelete} data-testid={askPageTestIds.undo}>
            Undo
          </button>
        </div>
      );
    }
    if (suggestions.held !== null) {
      return (
        <div
          key={suggestions.held.question.id}
          className={`${styles.toast} ${styles.questionToast}`}
          role="status"
          data-testid={askPageTestIds.toast}
        >
          {REMOVAL_TOAST[suggestions.held.action]}
          <button type="button" className={styles.questionUndo} onClick={suggestions.undo} data-testid={askPageTestIds.undo}>
            Undo
          </button>
        </div>
      );
    }
    if (said !== null) {
      return (
        <div key={said.key} className={styles.toast} role="status" data-testid={askPageTestIds.toast}>
          <StrokeIcon name={said.done ? "check" : "alertCircle"} size={17} />
          {said.text}
        </div>
      );
    }
    return null;
  };
  const toast = toastFor();

  const field =
    wait !== null ? (
      <ChatWaitBlock
        copy={chatWaitCopy(wait, usage?.plan ?? "free", usage?.resetsOn ?? null)}
        onNewConversation={page.newConversation}
        onPlansFollowed={() => analytics.ask.chat.plansFollowed({ scope })}
      />
    ) : (
      <ChatComposer
        ref={page.field}
        pinned={page.pinned}
        liveSources={page.liveSources}
        onPin={page.pin}
        onUnpin={page.unpin}
        onRemoveSource={page.removeSource}
        onClear={page.clearSources}
        value={draft}
        placeholder={placeholderOf(isPhone, scope)}
        answering={answering}
        large={empty}
        onChange={setDraft}
        onSend={() => send(draft)}
        onStop={page.stop}
      />
    );
  const composer = (
    <>
      {field}
      {wait === null && meter !== null && (
        <ChatMeterLine meter={meter} onPlansFollowed={() => analytics.ask.chat.plansFollowed({ scope })} />
      )}
    </>
  );

  const answerOf = (message: Extract<ChatMessage, { from: "answer" }>, index: number) => (
    <AskAnswer
      text={message.text}
      sections={message.sections}
      citations={message.citations}
      stats={message.stats}
      scope={scope}
      arrived={index === arrivedAt}
      holds={holds}
      imageOf={imageOf}
      onFollowed={followed}
      onSourcesOpened={(sources) => analytics.ask.chat.sourcesMenuOpened({ scope, sources })}
      actions={(sources) => (
        <ChatAnswerActions
          answer={message.text}
          latest={index === latestAnswerAt && pending === null}
          onSaid={say}
          onCopied={() => analytics.ask.chat.answerCopied({ scope })}
          sources={sources}
        />
      )}
    />
  );

  return (
    <main className={styles.root} data-testid={askPageTestIds.root}>
      {(isPhone || drawerOpen || drawerLeaving) && (
        <AskDrawer
          open={drawerOpen}
          motion={drawerMotionOf(drawerOpen, drawerArrives)}
          chats={page.chats}
          openChatId={page.chat?.id ?? null}
          now={now}
          projectName={(id) => projects.find((each) => each.id === id)?.name ?? null}
          overviewTitle={(id) => (library === undefined ? "" : (overviewOf(id)?.source.title ?? null))}
          sheet={isPhone}
          onNew={() => {
            if (isPhone) {
              hideDrawer();
            }
            page.newConversation();
          }}
          onOpen={(chat) => {
            if (isPhone) {
              hideDrawer();
            }
            page.openConversation(chat);
          }}
          onDelete={page.deleteConversation}
          onClose={() => {
            hideDrawer();
            if (!isPhone) {
              requestAnimationFrame(() => drawerButton.current?.focus());
            }
          }}
        />
      )}
      <div className={styles.main}>
        {(!drawerOpen || isPhone) && (
          <div className={styles.top}>
            <button
              type="button"
              ref={drawerButton}
              className={styles.drawerButton}
              aria-label="Show conversations"
              aria-expanded={drawerOpen}
              onClick={() => {
                if (drawerOpen) {
                  hideDrawer();
                } else {
                  showDrawer();
                }
              }}
              data-testid={askPageTestIds.drawerButton}
            >
              <StrokeIcon name="panelOpen" size={18} />
            </button>
          </div>
        )}
        <div className={styles.column}>
          {empty ? (
            <div className={styles.start}>
              {project !== null && (
                <PageLink className={styles.scope} to={Routes.project(project.id)} data-testid={askPageTestIds.scopeChip}>
                  <StrokeIcon name="folder" size={14} />
                  {project.name}
                </PageLink>
              )}
              <h1 className={styles.heading} data-testid={askPageTestIds.heading}>
                {scope === "project" ? "Ask about this project." : "Ask across everything you’ve saved."}
              </h1>
              {composer}
              {questionsShowing && suggestions.questions.length > 0 && templatesOnly && (
                <ul className={styles.starters} aria-label="Questions to start with" data-testid={askPageTestIds.starters}>
                  {suggestions.questions.map((question) => (
                    <li key={question.id}>
                      <button
                        type="button"
                        className={styles.starter}
                        aria-disabled={offline || undefined}
                        onClick={() => askSuggested(question)}
                        data-testid={askPageTestIds.starter}
                      >
                        {question.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {questionsShowing && !templatesOnly && (
                <AskQuestionCards
                  questions={suggestions.questions}
                  page={suggestions.page}
                  pages={suggestions.pages}
                  total={suggestions.total}
                  canCycle={suggestions.canCycle}
                  waiting={offline}
                  onNext={suggestions.next}
                  onAsk={askSuggested}
                  onToggleGood={suggestions.toggleGood}
                  onNotUseful={suggestions.notUseful}
                  onHide={suggestions.hide}
                  onChipOpened={suggestions.chipOpened}
                />
              )}
            </div>
          ) : (
            <>
              <ol className={styles.messages} data-testid={askPageTestIds.messages}>
                {messages.map((message, index) =>
                  message.from === "reader" ? (
                    <Fragment key={index}>
                      <ChatDrewOn
                        how="pinned"
                        sources={(message.sources ?? []).filter((source) => source.how === "pinned")}
                        overviewOf={overviewOf}
                        onFollow={followed}
                      />
                      <li className={styles.question} data-testid={askPageTestIds.question}>
                        {message.text}
                      </li>
                      {(message.picked ?? []).length > 0 && (
                        <li className={styles.picking}>
                          <AskPickingWait
                            phase="read"
                            picked={pickedOf(message)}
                            imageOf={imageOf}
                            holds={holds}
                            onOpened={() => analytics.ask.chat.readOpened({ scope })}
                            onFollow={followed}
                          />
                        </li>
                      )}
                    </Fragment>
                  ) : (
                    <li key={index} className={styles.answer} data-answer="" data-testid={askPageTestIds.answer}>
                      {answerOf(message, index)}
                    </li>
                  ),
                )}
                {pending !== null && (
                  <>
                    {pending.status === "answering" && pending.sources !== null && (
                      <ChatDrewOn how="pinned" sources={pending.sources.pinned} overviewOf={overviewOf} onFollow={followed} />
                    )}
                    <li className={styles.question} data-testid={askPageTestIds.question}>
                      {pending.question}
                    </li>
                    <li className={styles.answer} data-testid={askPageTestIds.pending}>
                      {pending.status === "answering" && pending.picking !== null && (
                        <div className={styles.picking}>
                          <AskPickingWait
                            phase={pickingPhaseOf(pending.picking, pending.text, pending.sections.length)}
                            picked={pending.picked}
                            {...(pending.looked === undefined ? {} : { looked: pending.looked })}
                            imageOf={imageOf}
                            holds={holds}
                            onOpened={() => analytics.ask.chat.readOpened({ scope })}
                            onFollow={followed}
                          />
                        </div>
                      )}
                      {(pending.status === "answering" || pending.status === "stopped") && (
                        <div className={styles.streaming} aria-busy={pending.status === "answering"}>
                          {pending.status === "answering" && pending.picking === null && pending.text === "" ? (
                            <span className={styles.dots} aria-hidden="true" data-testid={askPageTestIds.dots}>
                              <span />
                              <span />
                              <span />
                            </span>
                          ) : (
                            <ChatStreamedText text={pending.text} whole={pending.status === "stopped"} />
                          )}
                          {pending.status === "answering" && pending.sections.length > 0 && (
                            <div className={styles.text} data-testid={askPageTestIds.streamedSections}>
                              <ChatAnswerSectionsView sections={{ intro: "", introSources: [], sections: pending.sections }} />
                            </div>
                          )}
                          {pending.status === "stopped" && (
                            <p className={styles.status} data-testid={askPageTestIds.stopped}>
                              Stopped. This one didn’t count.
                            </p>
                          )}
                        </div>
                      )}
                      {pending.status === "failed" && (
                        <div className={styles.failure} role="alert" data-testid={askPageTestIds.failure}>
                          <p>Something went wrong answering that. Try again in a while.</p>
                          <button
                            type="button"
                            className={styles.pill}
                            onClick={() => page.ask(pending.question, "typed")}
                            data-testid={askPageTestIds.tryAgain}
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
              <div className={styles.foot}>{composer}</div>
            </>
          )}
        </div>
      </div>

      {toast !== null && (
        <div className={`${styles.toastSpot} ${page.deleting === null && suggestions.held !== null ? styles.questionToastSpot : ""}`}>
          {toast}
        </div>
      )}
      <p className={styles.live} aria-live="polite" data-testid={askPageTestIds.announcement}>
        {announcement}
      </p>
    </main>
  );
};
