import { useRef, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { ChatField } from "../ChatField/ChatField.js";
import styles from "./NoteAskField.module.scss";
import { noteAskFieldTestIds } from "./NoteAskFieldTestIds.js";

export interface NoteAskFieldProps {
  sourceWord: string;
  // While chat is open beside the note, the note's own field fades out and keeps its space (310a).
  chatOpen: boolean;
  conversations: number;
  onAsk: (question: string, from: HTMLElement | null) => void;
  onOpenConversations: () => void;
}

// Design 310d, 310a-3: "Ask about this video" under the questions to ask next, and under it the
// way into the overview's conversations. Sending opens chat with the question.
export const NoteAskField = ({ sourceWord, chatOpen, conversations, onAsk, onOpenConversations }: NoteAskFieldProps) => {
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLDivElement | null>(null);
  const send = () => {
    onAsk(draft.trim(), field.current);
    setDraft("");
  };
  return (
    <div className={styles.root}>
      <div ref={field} className={`${styles.field} ${chatOpen ? styles.away : ""}`} inert={chatOpen} data-testid={noteAskFieldTestIds.root}>
        <ChatField
          value={draft}
          placeholder={`Ask about this ${sourceWord}`}
          answering={false}
          onChange={setDraft}
          onSend={send}
          onStop={() => undefined}
        />
      </div>
      {conversations > 0 && (
        <button
          type="button"
          className={styles.conversations}
          onClick={onOpenConversations}
          data-testid={noteAskFieldTestIds.conversations}
        >
          <StrokeIcon name="chat" size={16} />
          {conversations} {conversations === 1 ? "conversation" : "conversations"} about this {sourceWord}
        </button>
      )}
    </div>
  );
};
