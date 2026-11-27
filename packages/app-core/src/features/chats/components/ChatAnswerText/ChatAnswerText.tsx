import { answerBlocks, type SpokenAnswerPlace } from "@overview/domain";
import { useBlockReading } from "../../readAloud/SpokenSentenceContext.js";
import { ChatCodeBlock } from "../ChatCodeBlock/ChatCodeBlock.js";
import { ChatMarkedText } from "../ChatMarkedText/ChatMarkedText.js";
import { ChatSentence } from "../ChatSentence/ChatSentence.js";

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

// A code block or table is spoken as one line, so it is one tap target, marked whole (design 418l).
const AnswerBlock = ({ block, index, place }: AnswerBlockProps) => {
  const reading = useBlockReading(place, index);
  const whole = reading?.ranges[0];
  if (block.kind === "code") {
    const code = <ChatCodeBlock language={block.language} code={block.code} />;
    return reading === null || whole === undefined ? (
      code
    ) : (
      <ChatSentence index={whole.index} current={whole.index === reading.current} choose={reading.choose} whole>
        {code}
      </ChatSentence>
    );
  }
  if (reading !== null && whole !== undefined && TABLE_ROW.test(block.text)) {
    return (
      <ChatSentence index={whole.index} current={whole.index === reading.current} choose={reading.choose} whole>
        <p>
          <ChatMarkedText text={block.text} />
        </p>
      </ChatSentence>
    );
  }
  return (
    <p>
      <ChatMarkedText text={block.text} reading={reading} />
    </p>
  );
};
