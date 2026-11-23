import type { CSSProperties, Ref } from "react";
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
      className={`${styles.card} ${leaving ? styles.leaving : ""}`}
      style={{ "--i": place } as CSSProperties}
      data-testid={askQuestionCardTestIds.card}
    >
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
        {question.text}
      </button>
      {custom !== null && (
        <div className={styles.references}>
          <AskQuestionReferences
            overviews={custom.overviews}
            good={custom.good}
            onOpened={onChipOpened}
            onToggleGood={() => onToggleGood(custom)}
            onNotUseful={() => onNotUseful(custom)}
            onHide={() => onHide(custom)}
          />
        </div>
      )}
    </li>
  );
};
