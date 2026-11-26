import { answerBlocks, type SpokenAnswerPlace } from "@overview/domain";
import { useSpokenRange } from "../../readAloud/SpokenSentenceContext.js";
import { ChatCodeBlock } from "../ChatCodeBlock/ChatCodeBlock.js";
import { ChatMarkedText } from "../ChatMarkedText/ChatMarkedText.js";
import styles from "./ChatAnswerText.module.scss";

const TABLE_ROW = /^\|.*\|$/;

export interface ChatAnswerTextProps {
  text: string;
  place?: SpokenAnswerPlace | undefined;
}

export const ChatAnswerText = ({ text, place }: ChatAnswerTextProps) => {
  return (
    <>
      {answerBlocks(text).map((block, index) => (
        <AnswerBlock key={index} block={block} index={index} place={place} />
      ))}
    </>
  );
};

interface AnswerBlockProps {
  block: ReturnType<typeof answerBlocks>[number];
  index: number;
  place: SpokenAnswerPlace | undefined;
}

// A code block or table is spoken as one line, so it is marked whole (design 418l).
const AnswerBlock = ({ block, index, place }: AnswerBlockProps) => {
  const spoken = useSpokenRange(place, index);
  if (block.kind === "code") {
    const code = <ChatCodeBlock language={block.language} code={block.code} />;
    return spoken === null ? (
      code
    ) : (
      <div className={styles.spokenWhole} data-spoken="">
        {code}
      </div>
    );
  }
  if (spoken !== null && TABLE_ROW.test(block.text)) {
    return (
      <p className={styles.spokenWhole} data-spoken="">
        <ChatMarkedText text={block.text} />
      </p>
    );
  }
  return (
    <p>
      <ChatMarkedText text={block.text} spoken={spoken} />
    </p>
  );
};
