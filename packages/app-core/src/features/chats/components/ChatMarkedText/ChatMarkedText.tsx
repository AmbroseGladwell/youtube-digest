import { Fragment } from "react";
import { inlineMarks } from "../../util/inlineMarks.js";

// An answer's words with their **bold** shown as bold, in every chat (OV-362).
export function ChatMarkedText({ text }: { text: string }) {
  return (
    <>
      {inlineMarks(text).map((piece, index) =>
        piece.bold ? <strong key={index}>{piece.text}</strong> : <Fragment key={index}>{piece.text}</Fragment>,
      )}
    </>
  );
}
