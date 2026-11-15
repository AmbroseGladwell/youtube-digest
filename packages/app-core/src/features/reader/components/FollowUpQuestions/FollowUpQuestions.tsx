import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FOLLOW_UP_ASSISTANTS,
  FOLLOW_UP_QUESTIONS_SECTION,
  FOLLOW_UP_QUESTIONS_SHOWN,
  followUpHandOff,
  followUpPrompt,
  recordAskedQuestion,
  type AskedQuestion,
  type FollowUpAssistant,
  type FollowUpQuestion,
  type Overview,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ReaderAnalytics } from "../../../analytics/bindOverviewId.js";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";
import { useFollowUpAssistant } from "../../useFollowUpAssistant.js";
import { askedLine } from "../../util/askedLine.js";
import { copyText, handOffFollowUp } from "../../util/handOffFollowUp.js";
import { FollowUpAssistantMenu } from "../FollowUpAssistantMenu/FollowUpAssistantMenu.js";
import styles from "./FollowUpQuestions.module.scss";
import { followUpQuestionsTestIds } from "./FollowUpQuestionsTestIds.js";

export interface FollowUpQuestionsProps {
  overview: Overview;
  questions: readonly FollowUpQuestion[];
  // A phone or the panel: bubbles run full width and the menu is a sheet (266u, 266ac).
  compact: boolean;
  // The reader's own record of which questions they've taken further (266aj), never shared.
  asked: readonly AskedQuestion[];
  onAsked: (asked: AskedQuestion[]) => void;
  analytics: ReaderAnalytics["followUps"];
}

type Motion = "arriving" | "idle" | "leaving" | "entering";
type Menu = { firstTap: true; index: number; top: number } | { firstTap: false; top: number };

const LEAVE_MS = 130;
const TOAST_MS = 4000;
const ARRIVAL_THRESHOLD = 0.4;

function setAnnouncement(from: number, to: number, of: number): string {
  return from === to ? `Question ${from} of ${of}` : `Questions ${from} to ${to} of ${of}`;
}

function AssistantLine({ assistant, connected, copies }: { assistant: FollowUpAssistant; connected: boolean; copies: boolean }) {
  const name = <b>{FOLLOW_UP_ASSISTANTS[assistant].name}</b>;
  if (copies) return <>Each copies the question and this note, then opens {name} for you to paste.</>;
  if (connected)
    return (
      <>
        Each opens {name},{" "}
        <span className={styles.connected}>
          <StrokeIcon name="plug" size={15} />
          connected
        </span>
        , so it can read this note and its transcript.
      </>
    );
  return <>Each opens {name} in a new tab with this note filled in.</>;
}

// A ghost of the tapped question shrinks and drops to the toast, so the reader sees something
// was picked up before they switch tabs (266am). Only when the tap copies.
function dropGhost(from: HTMLElement | null): Promise<void> {
  if (from === null || prefersReducedMotion() || typeof from.animate !== "function") return Promise.resolve();
  const rect = from.getBoundingClientRect();
  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "60",
  });
  document.body.appendChild(ghost);
  const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
  const dy = window.innerHeight - 40 - (rect.top + rect.height / 2);
  return ghost
    .animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.5 - 16}px) scale(0.6)`, opacity: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 560, easing: "cubic-bezier(.5,0,.25,1)" },
    )
    .finished.catch(() => undefined)
    .then(() => ghost.remove());
}

// Design 266a–266ao: the last block in the note, questions as speech bubbles to take to the
// reader's own assistant, three at a time. The app never answers them itself
// (docs/features/follow-up-questions.md).
export function FollowUpQuestions({ overview, questions, compact, asked, onAsked, analytics }: FollowUpQuestionsProps) {
  const { assistant, connectedTo, anyConnection, choose } = useFollowUpAssistant();
  const [set, setSet] = useState(0);
  const [motion, setMotion] = useState<Motion>(() => (prefersReducedMotion() ? "idle" : "arriving"));
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [toast, setToast] = useState<{ text: string; done: boolean; key: number } | null>(null);
  const [justAsked, setJustAsked] = useState<readonly string[]>([]);
  const headingId = useId();
  const root = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const changeButton = useRef<HTMLButtonElement | null>(null);
  const bubbles = useRef<(HTMLDivElement | null)[]>([]);
  const questionButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sets = Math.ceil(questions.length / FOLLOW_UP_QUESTIONS_SHOWN);
  const shown = questions.slice(set * FOLLOW_UP_QUESTIONS_SHOWN, (set + 1) * FOLLOW_UP_QUESTIONS_SHOWN);
  const handOffFor = (question: string, to: FollowUpAssistant) => followUpHandOff(to, followUpPrompt(question, overview, connectedTo(to)));
  const longest = questions.reduce((most, each) => (each.question.length > most.length ? each.question : most), "");
  const copies = assistant !== null && handOffFor(longest, assistant).kind === "copyThenOpen";

  useEffect(() => {
    if (motion !== "arriving") return;
    const element = root.current;
    if (element === null || typeof IntersectionObserver === "undefined") {
      setMotion("idle");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setMotion("idle");
      },
      { threshold: ARRIVAL_THRESHOLD },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [motion]);

  // The next three start where the old ones went, then settle once the browser has seen them there.
  useLayoutEffect(() => {
    if (motion !== "entering") return;
    void list.current?.offsetHeight;
    setMotion("idle");
  }, [motion]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    },
    [],
  );

  if (questions.length === 0) return null;

  const showToast = (text: string, done: boolean) => setToast({ text, done, key: Date.now() });

  const ask = (index: number, to: FollowUpAssistant) => {
    const { question, forReader } = questions[index]!;
    const handOff = handOffFor(question, to);
    const name = FOLLOW_UP_ASSISTANTS[to].name;
    analytics.asked({ assistant: to, handOff: handOff.kind, connected: connectedTo(to), forReader, position: index + 1 });
    const copied = handOffFollowUp(handOff);
    onAsked(
      recordAskedQuestion(
        asked,
        { question, assistant: to, askedAt: new Date().toISOString() },
        questions.map((each) => each.question),
      ),
    );
    setJustAsked((current) => [...current, question]);
    if (handOff.kind === "prefill") {
      setSaid(`Opening ${name} in a new tab`);
      return;
    }
    void Promise.all([copied, dropGhost(bubbles.current[index % FOLLOW_UP_QUESTIONS_SHOWN] ?? null)]).then(([ok]) =>
      showToast(
        ok ? `Copied. ${name} is opening in a new tab: paste it there.` : `That couldn’t be copied. ${name} is opening in a new tab.`,
        ok,
      ),
    );
  };

  const topBelow = (element: HTMLElement | null, gap: number) =>
    element === null || root.current === null ? 0 : element.getBoundingClientRect().bottom - root.current.getBoundingClientRect().top + gap;

  const closeMenu = () => {
    const open = menu;
    setMenu(null);
    if (open === null) return;
    (open.firstTap ? questionButtons.current[open.index % FOLLOW_UP_QUESTIONS_SHOWN] : changeButton.current)?.focus();
  };

  const tap = (index: number) => {
    if (assistant !== null) {
      ask(index, assistant);
      return;
    }
    if (menu?.firstTap && menu.index === index) {
      closeMenu();
      return;
    }
    setMenu({ firstTap: true, index, top: topBelow(bubbles.current[index % FOLLOW_UP_QUESTIONS_SHOWN] ?? null, 6) });
  };

  const chooseFromMenu = (to: FollowUpAssistant) => {
    if (menu === null) return;
    analytics.assistantChosen({ assistant: to, from: menu.firstTap ? "firstTap" : "change" });
    choose(to);
    closeMenu();
    if (menu.firstTap) ask(menu.index, to);
  };

  const copyQuestion = () => {
    if (menu === null || !menu.firstTap) return;
    analytics.questionCopied();
    const question = questions[menu.index]!.question;
    closeMenu();
    void copyText(question).then((ok) => showToast(ok ? "Question copied" : "That couldn’t be copied.", ok));
  };

  const changeSet = () => {
    const next = (set + 1) % sets;
    setMenu(null);
    analytics.setChanged({ set: next + 1, sets });
    const announcement = setAnnouncement(
      next * FOLLOW_UP_QUESTIONS_SHOWN + 1,
      Math.min(questions.length, (next + 1) * FOLLOW_UP_QUESTIONS_SHOWN),
      questions.length,
    );
    if (prefersReducedMotion()) {
      setSet(next);
      setSaid(announcement);
      return;
    }
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    setMotion("leaving");
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      setSet(next);
      setMotion("entering");
      setSaid(announcement);
    }, LEAVE_MS);
  };

  const nameOf = (question: string): string => {
    if (assistant === null) return `${question}: choose an assistant to ask`;
    const name = FOLLOW_UP_ASSISTANTS[assistant].name;
    return copies
      ? `Copy and open ${name}: ${question} Copies the question and this note, then opens ${name} in a new tab for you to paste`
      : `Ask ${name}: ${question} (opens in a new tab)`;
  };
  const hoverLabel = assistant === null || compact ? undefined : `Ask ${FOLLOW_UP_ASSISTANTS[assistant].name} ↗`;

  let line: ReactNode = "Each opens your assistant. You’ll choose which on your first tap.";
  if (assistant !== null)
    line = (
      <>
        <AssistantLine assistant={assistant} connected={connectedTo(assistant)} copies={copies} />{" "}
        <button
          type="button"
          ref={changeButton}
          className={styles.change}
          aria-haspopup="dialog"
          aria-expanded={menu !== null && !menu.firstTap}
          onClick={() =>
            menu !== null && !menu.firstTap ? closeMenu() : setMenu({ firstTap: false, top: topBelow(changeButton.current, 4) })
          }
          data-testid={followUpQuestionsTestIds.change}
        >
          Change
        </button>
      </>
    );

  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : styles.centred}`}
      ref={root}
      role="group"
      aria-labelledby={headingId}
      data-testid={followUpQuestionsTestIds.root}
    >
      <p className={styles.heading} id={headingId}>
        {FOLLOW_UP_QUESTIONS_SECTION}
      </p>
      <p className={styles.line} data-testid={followUpQuestionsTestIds.line}>
        {line}
      </p>
      <ul className={`${styles.list} ${styles[motion] ?? ""}`} ref={list}>
        {shown.map(({ question }, place) => {
          const index = set * FOLLOW_UP_QUESTIONS_SHOWN + place;
          const held = pressed === place || (menu?.firstTap === true && menu.index === index);
          const receipt = asked.find((each) => each.question === question) ?? null;
          const receiptId = `${headingId}-asked-${index}`;
          return (
            <li
              key={index}
              className={`${styles.item} ${receipt !== null ? styles.askedItem : ""}`}
              style={{ "--i": place } as CSSProperties}
              data-testid={followUpQuestionsTestIds.item}
            >
              <div
                className={`${styles.bubble} ${held ? styles.held : ""}`}
                data-label={receipt === null ? hoverLabel : undefined}
                ref={(element) => {
                  bubbles.current[place] = element;
                }}
              >
                <button
                  type="button"
                  className={styles.question}
                  ref={(element) => {
                    questionButtons.current[place] = element;
                  }}
                  aria-label={nameOf(question)}
                  aria-describedby={receipt === null ? undefined : receiptId}
                  aria-haspopup={assistant === null ? "dialog" : undefined}
                  aria-expanded={assistant === null ? menu?.firstTap === true && menu.index === index : undefined}
                  onClick={() => tap(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setPressed(place);
                  }}
                  onKeyUp={() => setPressed(null)}
                  onBlur={() => setPressed(null)}
                  data-testid={followUpQuestionsTestIds.question}
                >
                  {question}
                </button>
              </div>
              {receipt !== null && (
                <span
                  id={receiptId}
                  className={`${styles.receipt} ${justAsked.includes(question) ? styles.fresh : ""}`}
                  data-testid={followUpQuestionsTestIds.receipt}
                >
                  {askedLine(receipt, new Date())}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {sets > 1 && (
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.different}
            aria-label={`Different questions, ${set + 1} of ${sets}`}
            onClick={changeSet}
            data-testid={followUpQuestionsTestIds.different}
          >
            <StrokeIcon name="rotateCw" size={15} />
            Different questions
          </button>
          <span className={styles.count} aria-hidden="true" data-testid={followUpQuestionsTestIds.count}>
            {set + 1} of {sets}
          </span>
        </div>
      )}
      {menu !== null && (
        <FollowUpAssistantMenu
          firstTap={menu.firstTap}
          chosen={assistant}
          connectedTo={connectedTo}
          anyConnection={anyConnection}
          asSheet={compact}
          top={menu.top}
          inside={menu.firstTap ? { current: bubbles.current[menu.index % FOLLOW_UP_QUESTIONS_SHOWN] ?? null } : changeButton}
          onChoose={chooseFromMenu}
          onCopyQuestion={copyQuestion}
          onSetUpFollowed={() => analytics.connectionSetUpFollowed()}
          onClose={closeMenu}
        />
      )}
      <p className={styles.said} aria-live="polite" data-testid={followUpQuestionsTestIds.said}>
        {said}
      </p>
      {toast !== null &&
        createPortal(
          <div key={toast.key} className={styles.toast} role="status" data-testid={followUpQuestionsTestIds.toast}>
            <StrokeIcon name={toast.done ? "check" : "alertCircle"} size={17} />
            {toast.text}
          </div>,
          document.body,
        )}
    </div>
  );
}
