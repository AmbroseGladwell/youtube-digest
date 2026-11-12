import styles from "./TimerRing.module.scss";

export interface TimerRingProps {
  leftMs: number;
  totalMs: number;
  paused: boolean;
  size?: number;
}

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Designs 284g and 284r: the ring empties as the timer runs, and goes muted while paused.
export function TimerRing({ leftMs, totalMs, paused, size = 34 }: TimerRingProps) {
  const left = totalMs <= 0 ? 0 : Math.min(Math.max(leftMs / totalMs, 0), 1);
  return (
    <svg className={`${styles.ring} ${paused ? styles.paused : ""}`} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle className={styles.track} cx="18" cy="18" r={RADIUS} />
      <circle
        className={styles.fill}
        cx="18"
        cy="18"
        r={RADIUS}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - left)}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}
