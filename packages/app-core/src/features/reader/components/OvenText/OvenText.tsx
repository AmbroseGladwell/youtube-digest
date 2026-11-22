import { Fragment, type ReactNode } from "react";
import { methodPieces, usOvenTemperatures, type IngredientPiece, type MethodAmount } from "@overview/domain";
import styles from "./OvenText.module.scss";
import { ovenTextTestIds } from "./OvenTextTestIds.js";

export interface OvenTextProps {
  text: string;
  us: boolean;
  amounts?: readonly MethodAmount[];
}

const pieceNode = (piece: IngredientPiece, index: number, us: boolean): ReactNode => {
  if (piece.changed) {
    return (
      <span key={index} className={styles.converted} data-testid={ovenTextTestIds.adjusted}>
        {piece.text}
      </span>
    );
  }
  if (us) {
    return usOvenTemperatures(piece.text).map((part, at) =>
      part.converted ? (
        <span key={`${index}.${at}`} className={styles.converted} data-testid={ovenTextTestIds.converted}>
          {part.text}
        </span>
      ) : (
        <Fragment key={`${index}.${at}`}>{part.text}</Fragment>
      ),
    );
  }
  return <Fragment key={index}>{piece.text}</Fragment>;
};

export const OvenText = ({ text, us, amounts = [] }: OvenTextProps) => {
  if (!us && amounts.length === 0) {
    return <>{text}</>;
  }
  return <>{methodPieces(text, amounts).map((piece, index) => pieceNode(piece, index, us))}</>;
};
