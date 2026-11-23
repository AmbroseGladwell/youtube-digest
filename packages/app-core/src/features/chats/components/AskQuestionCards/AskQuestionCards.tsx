import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";
import type { AskQuestion, CustomAskQuestion } from "../../types/AskQuestion.js";
import { ASK_QUESTIONS_SHOWN } from "../../util/askQuestionSet.js";
import { AskQuestionCard } from "../AskQuestionCard/AskQuestionCard.js";
import styles from "./AskQuestionCards.module.scss";
import { askQuestionCardsTestIds } from "./AskQuestionCardsTestIds.js";

export interface AskQuestionCardsProps {
  questions: readonly AskQuestion[];
  page: number;
  pages: number;
  total: number;
  canCycle: boolean;
  waiting: boolean;
  onNext: () => void;
  onAsk: (question: AskQuestion) => void;
  onToggleGood: (question: CustomAskQuestion) => void;
  onNotUseful: (question: CustomAskQuestion) => void;
  onHide: (question: CustomAskQuestion) => void;
  onChipOpened: () => void;
}

type Motion = "idle" | "leaving" | "entering";

const LEAVE_MS = 130;

export const askQuestionSetAnnouncement = (page: number, total: number): string => {
  const from = page * ASK_QUESTIONS_SHOWN + 1;
  const to = Math.min(total, from + ASK_QUESTIONS_SHOWN - 1);
  return from === to ? `Question ${from} of ${total}` : `Questions ${from} to ${to} of ${total}`;
};

export const AskQuestionCards = ({
  questions,
  page,
  pages,
  total,
  canCycle,
  waiting,
  onNext,
  onAsk,
  onToggleGood,
  onNotUseful,
  onHide,
  onChipOpened,
}: AskQuestionCardsProps) => {
  const [motion, setMotion] = useState<Motion>("idle");
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [focusPlace, setFocusPlace] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const list = useRef<HTMLUListElement | null>(null);
  const questionButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (motion !== "entering") {
      return;
    }
    void list.current?.offsetHeight;
    setMotion("idle");
  }, [motion]);

  useEffect(() => {
    if (focusPlace === null) {
      return;
    }
    setFocusPlace(null);
    questionButtons.current[Math.min(focusPlace, questions.length - 1)]?.focus({ preventScroll: true });
  }, [focusPlace, questions]);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const afterMotion = (run: () => void) => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      run();
    }, LEAVE_MS);
  };

  const changeSet = () => {
    const announcement = askQuestionSetAnnouncement((page + 1) % pages, total);
    if (prefersReducedMotion()) {
      onNext();
      setSaid(announcement);
      return;
    }
    setMotion("leaving");
    afterMotion(() => {
      onNext();
      setMotion("entering");
      setSaid(announcement);
    });
  };

  const remove = (question: CustomAskQuestion, place: number, take: (question: CustomAskQuestion) => void) => {
    const done = () => {
      take(question);
      setLeavingId(null);
      setFocusPlace(place);
      setSaid("Question removed.");
    };
    if (prefersReducedMotion()) {
      done();
      return;
    }
    setLeavingId(question.id);
    afterMotion(done);
  };

  return (
    <>
      <ul
        className={`${styles.list} ${styles[motion] ?? ""}`}
        ref={list}
        aria-label="Questions to start with"
        data-testid={askQuestionCardsTestIds.list}
      >
        {questions.map((question, place) => (
          <AskQuestionCard
            key={question.id}
            question={question}
            place={place}
            leaving={leavingId === question.id}
            waiting={waiting}
            questionRef={(element) => {
              questionButtons.current[place] = element;
            }}
            onAsk={() => onAsk(question)}
            onToggleGood={onToggleGood}
            onNotUseful={(each) => remove(each, place, onNotUseful)}
            onHide={(each) => remove(each, place, onHide)}
            onChipOpened={onChipOpened}
          />
        ))}
      </ul>
      {canCycle && (
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.different}
            aria-label={`Different questions, ${page + 1} of ${pages}`}
            onClick={changeSet}
            data-testid={askQuestionCardsTestIds.different}
          >
            <StrokeIcon name="rotateCw" size={15} />
            Different questions
          </button>
          <span className={styles.count} aria-hidden="true" data-testid={askQuestionCardsTestIds.count}>
            {page + 1} of {pages}
          </span>
        </div>
      )}
      <p className={styles.said} aria-live="polite" data-testid={askQuestionCardsTestIds.said}>
        {said}
      </p>
    </>
  );
};
