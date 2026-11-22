import { answerBlocks } from "@overview/domain";
import { ChatCodeBlock } from "../ChatCodeBlock/ChatCodeBlock.js";
import { ChatMarkedText } from "../ChatMarkedText/ChatMarkedText.js";

export const ChatAnswerText = ({ text }: { text: string }) => {
  return (
    <>
      {answerBlocks(text).map((block, index) =>
        block.kind === "code" ? (
          <ChatCodeBlock key={index} language={block.language} code={block.code} />
        ) : (
          <p key={index}>
            <ChatMarkedText text={block.text} />
          </p>
        ),
      )}
    </>
  );
};
