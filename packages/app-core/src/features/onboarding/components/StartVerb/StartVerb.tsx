import { useEffect, useRef, useState } from "react";
import styles from "./StartVerb.module.scss";

const ROLL_MS = 560;

// Design 155l: Start's headline verb follows the deck's front card, Watch Less for a video,
// Learn More for an article, Cook More for a recipe. The old verb rolls up out of a clipped line
// as the new one rises in; with reduced motion the verb simply changes.
export function StartVerb({ verb }: { verb: string }) {
  const [shown, setShown] = useState({ verb, previous: null as string | null, turn: 0 });
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (verb === shown.verb) return;
    setShown((now) => ({ verb, previous: now.verb, turn: now.turn + 1 }));
    clearTimeout(clear.current ?? undefined);
    clear.current = setTimeout(() => setShown((now) => ({ ...now, previous: null })), ROLL_MS + 40);
  }, [verb, shown.verb]);
  useEffect(() => () => clearTimeout(clear.current ?? undefined), []);

  return (
    <span className={styles.root}>
      {shown.previous !== null && (
        <span key={`out-${shown.turn}`} className={styles.out} aria-hidden="true">
          {shown.previous}
        </span>
      )}
      <span key={`in-${shown.turn}`} className={shown.turn === 0 ? styles.word : `${styles.word} ${styles.in}`}>
        {shown.verb}
      </span>
    </span>
  );
}
