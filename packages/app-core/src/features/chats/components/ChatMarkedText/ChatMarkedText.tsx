import { Fragment, type ReactNode } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { inlineMarks, placedMarks, type MarkedPiece } from "../../util/inlineMarks.js";
import type { BlockReading } from "../../readAloud/SpokenSentenceContext.js";
import { groupBySentence, sentencePieces } from "../../util/sentencePieces.js";
import { ChatSentence } from "../ChatSentence/ChatSentence.js";
import { chatAnswerTestIds } from "../ChatAnswer/ChatAnswerTestIds.js";
import styles from "./ChatMarkedText.module.scss";
import { chatMarkedTextTestIds } from "./ChatMarkedTextTestIds.js";

// The prompt names this place verbatim (OV-342), so code, not the model, makes it a link.
const PERSONALISATION = "Settings › Personalisation";

const withSettingsLinks = (text: string): ReactNode =>
  text.split(PERSONALISATION).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <PageLink
          to={Routes.settingsSection("personalisation")}
          className={styles.settingsLink}
          data-testid={chatAnswerTestIds.settingsLink}
        >
          {PERSONALISATION}
        </PageLink>
      )}
      {part}
    </Fragment>
  ));

export interface MarkedPieceViewProps {
  piece: MarkedPiece;
  className?: string | undefined;
}

export const MarkedPieceView = ({ piece, className }: MarkedPieceViewProps) => {
  let node: ReactNode = piece.code ? <code className={styles.code}>{piece.text}</code> : withSettingsLinks(piece.text);
  if (piece.href !== undefined) {
    node = (
      <a className={styles.link} href={piece.href} target="_blank" rel="noopener noreferrer" data-testid={chatMarkedTextTestIds.link}>
        {node}
        <span className={styles.hidden}> (opens in a new tab)</span>
      </a>
    );
  }
  if (piece.italic) {
    node = <em>{node}</em>;
  }
  if (piece.bold) {
    node = <strong>{node}</strong>;
  }
  return className === undefined ? <>{node}</> : <span className={className}>{node}</span>;
};

export interface ChatMarkedTextProps {
  text: string;
  reading?: BlockReading | null;
}

export const ChatMarkedText = ({ text, reading = null }: ChatMarkedTextProps) => {
  if (reading === null) {
    return (
      <>
        {inlineMarks(text).map((piece, index) => (
          <MarkedPieceView key={index} piece={piece} />
        ))}
      </>
    );
  }
  return (
    <>
      {groupBySentence(sentencePieces(placedMarks(text), reading.ranges)).map(({ sentence, pieces }, index) => {
        const shown = pieces.map((piece, at) => <MarkedPieceView key={at} piece={piece} />);
        return sentence === null ? (
          <Fragment key={index}>{shown}</Fragment>
        ) : (
          <ChatSentence key={index} index={sentence} current={sentence === reading.current} choose={reading.choose}>
            {shown}
          </ChatSentence>
        );
      })}
    </>
  );
};
