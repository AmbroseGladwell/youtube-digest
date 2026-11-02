import { useRef, type KeyboardEvent } from "react";
import { howToApplyFlipTestIds } from "./HowToApplyFlipTestIds.js";
import styles from "./HowToApplyFlip.module.scss";

export type FlipSide = "you" | "anyone";

export interface HowToApplyFlipProps {
  side: FlipSide;
  writing: boolean;
  onChoose: (side: FlipSide) => void;
}

// Design 141o: a real two-option radio group beside the heading. While For anyone is written
// it can't be chosen, and says so in its name.
export function HowToApplyFlip({ side, writing, onChoose }: HowToApplyFlipProps) {
  const you = useRef<HTMLButtonElement | null>(null);
  const anyone = useRef<HTMLButtonElement | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (writing || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = side === "you" ? "anyone" : "you";
    onChoose(next);
    (next === "you" ? you : anyone).current?.focus();
  };

  return (
    <div className={styles.root} role="radiogroup" aria-label="How to apply, written" onKeyDown={onKeyDown} data-testid={howToApplyFlipTestIds.root}>
      <button
        type="button"
        ref={you}
        role="radio"
        className={styles.option}
        aria-checked={side === "you"}
        tabIndex={side === "you" ? 0 : -1}
        onClick={() => onChoose("you")}
        data-testid={howToApplyFlipTestIds.forYou}
      >
        Written for you
      </button>
      <button
        type="button"
        ref={anyone}
        role="radio"
        className={styles.option}
        aria-checked={side === "anyone"}
        aria-disabled={writing}
        aria-label={writing ? "For anyone, still being written" : undefined}
        tabIndex={side === "anyone" ? 0 : -1}
        onClick={() => {
          if (!writing) onChoose("anyone");
        }}
        data-testid={howToApplyFlipTestIds.forAnyone}
      >
        {writing && <span className={styles.spinner} aria-hidden="true" />}
        For anyone
      </button>
    </div>
  );
}
