import { useState } from "react";
import { ChatField } from "../ChatField/ChatField.js";
import styles from "./NoteAskField.module.scss";
import { noteAskFieldTestIds } from "./NoteAskFieldTestIds.js";

export interface NoteAskFieldProps {
  sourceWord: string;
  // While chat is open beside the note, the note's own field fades out and keeps its space (310a).
  chatOpen: boolean;
  onAsk: (question: string) => void;
}

// Design 310d: "Ask about this video" under the questions to ask next. Sending opens chat with it.
export function NoteAskField({ sourceWord, chatOpen, onAsk }: NoteAskFieldProps) {
  const [draft, setDraft] = useState("");
  const send = () => {
    onAsk(draft.trim());
    setDraft("");
  };
  return (
    <div className={`${styles.root} ${chatOpen ? styles.away : ""}`} inert={chatOpen} data-testid={noteAskFieldTestIds.root}>
      <ChatField
        value={draft}
        placeholder={`Ask about this ${sourceWord}`}
        answering={false}
        onChange={setDraft}
        onSend={send}
        onStop={() => undefined}
      />
    </div>
  );
}
