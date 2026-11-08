import { Fragment } from "react";
import { methodPieces, usOvenTemperatures, type MethodAmount } from "@overview/domain";
import styles from "./OvenText.module.scss";
import { ovenTextTestIds } from "./OvenTextTestIds.js";

export interface OvenTextProps {
  text: string;
  us: boolean;
  amounts?: readonly MethodAmount[];
}

// The method's words, with the amounts it repeats from adjusted ingredients adjusted too (231c)
// and its oven temperatures in Fahrenheit for US units (150ak), each marked as a changed
// ingredient amount is.
export function OvenText({ text, us, amounts = [] }: OvenTextProps) {
  if (!us && amounts.length === 0) return <>{text}</>;
  return (
    <>
      {methodPieces(text, amounts).map((piece, index) =>
        piece.changed ? (
          <span key={index} className={styles.converted} data-testid={ovenTextTestIds.adjusted}>
            {piece.text}
          </span>
        ) : us ? (
          usOvenTemperatures(piece.text).map((part, at) =>
            part.converted ? (
              <span key={`${index}.${at}`} className={styles.converted} data-testid={ovenTextTestIds.converted}>
                {part.text}
              </span>
            ) : (
              <Fragment key={`${index}.${at}`}>{part.text}</Fragment>
            ),
          )
        ) : (
          <Fragment key={index}>{piece.text}</Fragment>
        ),
      )}
    </>
  );
}
