import { usOvenTemperatures } from "@overview/domain";
import styles from "./OvenText.module.scss";
import { ovenTextTestIds } from "./OvenTextTestIds.js";

export interface OvenTextProps {
  text: string;
  us: boolean;
}

// The method's words, with its oven temperatures in Fahrenheit for US units, marked as the
// changed amounts are (design 150ak).
export function OvenText({ text, us }: OvenTextProps) {
  if (!us) return <>{text}</>;
  return (
    <>
      {usOvenTemperatures(text).map((piece, index) =>
        piece.converted ? (
          <span key={index} className={styles.converted} data-testid={ovenTextTestIds.converted}>
            {piece.text}
          </span>
        ) : (
          piece.text
        ),
      )}
    </>
  );
}
