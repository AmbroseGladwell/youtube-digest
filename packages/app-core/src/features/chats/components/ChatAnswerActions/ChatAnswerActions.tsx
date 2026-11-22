import type { ReactNode } from "react";
import { copyText } from "../../../reader/util/handOffFollowUp.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ChatAnswerActions.module.scss";
import { chatAnswerActionsTestIds } from "./ChatAnswerActionsTestIds.js";

export interface ChatAnswerActionsProps {
  answer: string;
  latest: boolean;
  onSaid: (text: string, done: boolean) => void;
  onCopied: () => void;
  sources?: ReactNode;
}

export const ChatAnswerActions = ({ answer, latest, onSaid, onCopied, sources }: ChatAnswerActionsProps) => {
  const copy = () => {
    onCopied();
    void copyText(answer).then((copied) => onSaid(copied ? "Answer copied" : "That couldn’t be copied.", copied));
  };

  return (
    <div className={`${styles.root} ${latest ? "" : styles.earlier}`} data-testid={chatAnswerActionsTestIds.root}>
      <button type="button" className={styles.copy} aria-label="Copy answer" onClick={copy} data-testid={chatAnswerActionsTestIds.copy}>
        <StrokeIcon name="copy" size={14} />
      </button>
      {sources}
    </div>
  );
};
