import type { CSSProperties, Ref } from "react";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useLongPressTip } from "../../../../util/useLongPressTip.js";
import type { AskQuestion, CustomAskQuestion } from "../../types/AskQuestion.js";
import { AskQuestionReferences } from "../AskQuestionReferences/AskQuestionReferences.js";
import styles from "./AskQuestionCard.module.scss";
import { askQuestionCardTestIds } from "./AskQuestionCardTestIds.js";

export interface AskQuestionCardProps {
  question: AskQuestion;
  place: number;
  leaving: boolean;
  waiting: boolean;
  questionRef: Ref<HTMLButtonElement>;
  onAsk: () => void;
  onToggleGood: (question: CustomAskQuestion) => void;
  onNotUseful: (question: CustomAskQuestion) => void;
  onHide: (question: CustomAskQuestion) => void;
  onChipOpened: () => void;
}

interface FeedbackButtonProps {
  icon: StrokeIconName;
  label: string;
  question: string;
  pressed?: boolean;
  onPress: () => void;
  testId: string;
}

const FeedbackButton = ({ icon, label, question, pressed, onPress, testId }: FeedbackButtonProps) => {
  const press = useLongPressTip();
  return (
    <button
      type="button"
      className={`${styles.feedbackButton} ${pressed ? styles.pressed : ""}`}
      aria-label={`${label}: ${question}`}
      aria-pressed={pressed}
      onClick={onPress}
      {...press}
      data-testid={testId}
    >
      <StrokeIcon name={icon} size={14} />
      <span className={styles.tip} aria-hidden="true" data-testid={askQuestionCardTestIds.tip}>
        {label}
      </span>
    </button>
  );
};

export const AskQuestionCard = ({
  question,
  place,
  leaving,
  waiting,
  questionRef,
  onAsk,
  onToggleGood,
  onNotUseful,
  onHide,
  onChipOpened,
}: AskQuestionCardProps) => {
  const custom = question.kind === "custom" ? question : null;
  return (
    <li
      className={`${styles.card} ${custom === null ? styles.template : styles.custom} ${leaving ? styles.leaving : ""}`}
      style={{ "--i": place } as CSSProperties}
      data-testid={askQuestionCardTestIds.card}
    >
      {custom !== null && (
        <div className={styles.top}>
          <div
            className={styles.feedback}
            role="group"
            aria-label="Feedback on this question"
            data-testid={askQuestionCardTestIds.feedback}
          >
            <FeedbackButton
              icon="thumbsUp"
              label="Good question"
              question={custom.text}
              pressed={custom.good}
              onPress={() => onToggleGood(custom)}
              testId={askQuestionCardTestIds.good}
            />
            <FeedbackButton
              icon="thumbsDown"
              label="Not useful"
              question={custom.text}
              onPress={() => onNotUseful(custom)}
              testId={askQuestionCardTestIds.notUseful}
            />
            <FeedbackButton
              icon="close"
              label="Hide"
              question={custom.text}
              onPress={() => onHide(custom)}
              testId={askQuestionCardTestIds.hide}
            />
          </div>
          <AskQuestionReferences overviews={custom.overviews} onOpened={onChipOpened} />
        </div>
      )}
      <button
        type="button"
        ref={questionRef}
        className={styles.question}
        aria-disabled={waiting || undefined}
        onClick={() => {
          if (!waiting) {
            onAsk();
          }
        }}
        data-testid={askQuestionCardTestIds.question}
      >
        <StrokeIcon name="cornerDownRight" size={15} />
        <span>{question.text}</span>
      </button>
    </li>
  );
};
