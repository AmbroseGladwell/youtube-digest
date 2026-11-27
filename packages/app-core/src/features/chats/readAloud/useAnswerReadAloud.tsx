import type { ReactNode } from "react";
import { ReadAloudControl, type ReadAloudAbout } from "../components/ReadAloudControl/ReadAloudControl.js";
import { ReadAloudProblem } from "../components/ReadAloudControl/ReadAloudProblem.js";
import { useReadAloud, useReadAloudSnapshot } from "./ReadAloudContext.js";
import { sameAnswer } from "./ReadAloudEngine.js";
import type { ReadingAnswer } from "./SpokenSentenceContext.js";

export interface AnswerReadAloudOptions {
  chatId: string | null;
  about: ReadAloudAbout;
  monthWaitShown: boolean;
  offerPlans: boolean;
  onPlansFollowed: () => void;
}

export interface AnswerReadAloud {
  reading: ReadingAnswer | null;
  top: ReactNode;
  control: ReactNode;
  below: ReactNode;
}

const NONE: AnswerReadAloud = { reading: null, top: undefined, control: null, below: null };

// The same controls in an overview's chat and on the Ask page (chat scopes stay in sync).
export const useAnswerReadAloud = ({ chatId, about, monthWaitShown, offerPlans, onPlansFollowed }: AnswerReadAloudOptions) => {
  const engine = useReadAloud();
  const snapshot = useReadAloudSnapshot();
  return (message: number): AnswerReadAloud => {
    if (chatId === null || snapshot === null || engine === null) {
      return NONE;
    }
    const answer = { chatId, message };
    const reading = sameAnswer(snapshot.answer, answer) && snapshot.status !== "idle" && snapshot.sentences.length > 0;
    return {
      reading: reading
        ? { sentences: snapshot.sentences, current: snapshot.sentence, choose: (sentence) => engine.chooseSentence(sentence) }
        : null,
      top: <ReadAloudControl answer={answer} about={about} control="top" />,
      control: <ReadAloudControl answer={answer} about={about} control="bottom" />,
      below: (
        <ReadAloudProblem
          answer={answer}
          about={about}
          monthWaitShown={monthWaitShown}
          offerPlans={offerPlans}
          onPlansFollowed={onPlansFollowed}
        />
      ),
    };
  };
};
