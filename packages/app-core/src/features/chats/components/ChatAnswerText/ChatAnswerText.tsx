import { answerBlocks } from "../../util/answerBlocks.js";
import { ChatCodeBlock } from "../ChatCodeBlock/ChatCodeBlock.js";
import { ChatMarkedText } from "../ChatMarkedText/ChatMarkedText.js";

// A field of an answer as it is drawn, the same in every chat (OV-364): its paragraphs with their
// inline Markdown, and its fenced code blocks.
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
