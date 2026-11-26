import type { ReactNode } from "react";
import { copyText } from "../../../reader/util/handOffFollowUp.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ChatAnswerActions.module.scss";
import { chatAnswerActionsTestIds } from "./ChatAnswerActionsTestIds.js";

export interface ChatAnswerActionsProps {
  answer: string;
  onSaid: (text: string, done: boolean) => void;
  onCopied: () => void;
  readAloud?: ReactNode;
  sources?: ReactNode;
  below?: ReactNode;
}

// Under every answer, not only the latest, since the play control lives here (design 418a).
export const ChatAnswerActions = ({ answer, onSaid, onCopied, readAloud, sources, below }: ChatAnswerActionsProps) => {
  const copy = () => {
    onCopied();
    void copyText(answer).then((copied) => onSaid(copied ? "Answer copied" : "That couldn’t be copied.", copied));
  };

  return (
    <>
      <div className={styles.root} data-testid={chatAnswerActionsTestIds.root}>
        <button type="button" className={styles.copy} aria-label="Copy answer" onClick={copy} data-testid={chatAnswerActionsTestIds.copy}>
          <StrokeIcon name="copy" size={14} />
        </button>
        {readAloud}
        {sources}
      </div>
      {below}
    </>
  );
};
