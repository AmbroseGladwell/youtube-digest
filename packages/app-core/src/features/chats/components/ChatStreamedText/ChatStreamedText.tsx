import { answerBlocks, type AnswerBlock } from "../../util/answerBlocks.js";
import { markedWords } from "../../util/inlineMarks.js";
import { ChatCodeBlock } from "../ChatCodeBlock/ChatCodeBlock.js";
import { MarkedPieceView } from "../ChatMarkedText/ChatMarkedText.js";
import styles from "./ChatStreamedText.module.scss";
import { chatStreamedTextTestIds } from "./ChatStreamedTextTestIds.js";

export interface ChatStreamedTextProps {
  text: string;
  whole: boolean;
}

// While it streams, the answer's last word is held back until it is whole, and a fence's backticks
// until they are three, so no marker ever shows.
const blocksSoFar = (text: string, whole: boolean): AnswerBlock[] => {
  if (whole) {
    return answerBlocks(text);
  }
  const blocks = answerBlocks(text.replace(/`{1,2}$/, ""));
  const last = blocks.at(-1);
  if (last?.kind === "paragraph" && !/\s$/.test(text)) {
    const held = last.text.replace(/\S+$/, "").trimEnd();
    return held === "" ? blocks.slice(0, -1) : [...blocks.slice(0, -1), { kind: "paragraph", text: held }];
  }
  return blocks;
};

// OV-341: each word fades in as it arrives, in the final answer's paragraphs, so nothing moves when it
// lands. Its Markdown shows as it is written, never its markers, and a code block grows line by line
// (OV-362, OV-364).
export const ChatStreamedText = ({ text, whole }: ChatStreamedTextProps) => {
  return (
    <div className={styles.root} data-testid={chatStreamedTextTestIds.root}>
      {blocksSoFar(text, whole).map((block, index) =>
        block.kind === "code" ? (
          <ChatCodeBlock key={index} language={block.language} code={block.code} />
        ) : (
          <p key={index}>
            {markedWords(block.text.match(/\S+\s*/g) ?? [], whole).map((piece, at) => (
              <MarkedPieceView key={at} piece={piece} className={styles.word} />
            ))}
          </p>
        ),
      )}
    </div>
  );
};
