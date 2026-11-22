import { Fragment, type ReactNode } from "react";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { inlineMarks, type MarkedPiece } from "../../util/inlineMarks.js";
import { chatAnswerTestIds } from "../ChatAnswer/ChatAnswerTestIds.js";
import styles from "./ChatMarkedText.module.scss";
import { chatMarkedTextTestIds } from "./ChatMarkedTextTestIds.js";

// The prompt names this place in so many words when a reader asks what chat knows about them
// (OV-342), so code, not the model, makes it a link.
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

export function MarkedPieceView({ piece, className }: { piece: MarkedPiece; className?: string | undefined }) {
  let node: ReactNode = piece.code ? <code className={styles.code}>{piece.text}</code> : withSettingsLinks(piece.text);
  if (piece.href !== undefined)
    node = (
      <a className={styles.link} href={piece.href} target="_blank" rel="noopener noreferrer" data-testid={chatMarkedTextTestIds.link}>
        {node}
        <span className={styles.hidden}> (opens in a new tab)</span>
      </a>
    );
  if (piece.italic) node = <em>{node}</em>;
  if (piece.bold) node = <strong>{node}</strong>;
  return className === undefined ? <>{node}</> : <span className={className}>{node}</span>;
}

// An answer's words with their inline Markdown drawn, in every chat (OV-362, OV-364): bold, italics,
// inline code and links that open in a new tab. Nothing else is read, so raw HTML stays text.
export function ChatMarkedText({ text }: { text: string }) {
  return (
    <>
      {inlineMarks(text).map((piece, index) => (
        <MarkedPieceView key={index} piece={piece} />
      ))}
    </>
  );
}
