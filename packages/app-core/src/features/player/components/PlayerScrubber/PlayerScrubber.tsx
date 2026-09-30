import { formatClock } from "@overview/domain";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { NoteLine } from "@overview/domain";
import { lineAtTime, nearestLineStart } from "../../util/lineAtTime.js";
import { sectionHeadingAt, type PlayerBarView } from "../../util/playerBarView.js";
import styles from "./PlayerScrubber.module.scss";
import { playerScrubberTestIds } from "./PlayerScrubberTestIds.js";

const KEY_STEP_SECONDS = 5;

export interface PlayerScrubberProps {
  view: PlayerBarView;
  time: number;
  lines: NoteLine[];
  lineStarts: number[];
  durationSeconds: number;
  onSeek: (seconds: number) => void;
}

// Design 2a: the line a drag will land on, named the way the note names it.
function landingLabel(lines: NoteLine[], index: number, seconds: number): string {
  const heading = sectionHeadingAt(lines, index);
  if (lines[index]?.heading) return `${heading} · ${formatClock(seconds)}`;
  let within = 0;
  for (let at = index; at >= 0 && !lines[at]!.heading; at -= 1) within += 1;
  return `${heading} · line ${within} · ${formatClock(seconds)}`;
}

const keyTarget = (key: string, time: number, durationSeconds: number): number | null => {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return time + KEY_STEP_SECONDS;
    case "ArrowLeft":
    case "ArrowDown":
      return time - KEY_STEP_SECONDS;
    case "Home":
      return 0;
    case "End":
      return durationSeconds;
    default:
      return null;
  }
};

// Design 1e and 2a: a thumb, a notch where each section starts, and a drag that snaps to
// the nearest line start. From the keyboard it is a slider that moves five seconds a step.
export function PlayerScrubber({ view, time, lines, lineStarts, durationSeconds, onSeek }: PlayerScrubberProps) {
  const track = useRef<HTMLDivElement | null>(null);
  const [landing, setLanding] = useState<{ index: number; seconds: number } | null>(null);
  const { fill, tone, thumb } = view.track;
  const percent =
    landing === null || durationSeconds <= 0 ? view.track.percent : (landing.seconds / durationSeconds) * 100;

  const landingAt = (clientX: number) => {
    const box = track.current!.getBoundingClientRect();
    const fraction = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    const index = nearestLineStart(lineStarts, fraction * durationSeconds);
    return { index, seconds: lineStarts[index] ?? 0 };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!view.seekable) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setLanding(landingAt(event.clientX));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (landing !== null) setLanding(landingAt(event.clientX));
  };
  const onPointerUp = () => {
    if (landing !== null) onSeek(landing.seconds);
    setLanding(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = keyTarget(event.key, time, durationSeconds);
    if (target === null) return;
    event.preventDefault();
    onSeek(target);
  };

  const accessible = view.seekable
    ? {
        role: "slider",
        tabIndex: 0,
        "aria-label": "Seek",
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(durationSeconds),
        "aria-valuenow": Math.round(time),
        "aria-valuetext": `${formatClock(time)} of ${formatClock(durationSeconds)}, ${sectionHeadingAt(
          lines,
          lineAtTime(lineStarts, time),
        )}`,
        onKeyDown,
      }
    : fill === "sweep"
      ? { role: "progressbar", "aria-label": "Preparing audio" }
      : {
          role: "progressbar",
          "aria-label": "Progress",
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": Math.round(fill === "none" ? 0 : percent),
        };

  return (
    <div
      className={`${styles.hitArea} ${view.seekable ? styles.seekable : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setLanding(null)}
      data-testid={playerScrubberTestIds.root}
      {...accessible}
    >
      <div className={styles.track} ref={track}>
        {fill === "progress" && (
          <span
            className={`${styles.fill} ${tone === "stone" ? styles.fillStone : ""}`}
            style={{ width: `${percent}%` }}
            data-testid={playerScrubberTestIds.fill}
          />
        )}
        {fill === "sweep" && <span className={styles.sweep} data-testid={playerScrubberTestIds.sweep} />}
        {view.notches.map((at) => (
          <span key={at} className={styles.notch} style={{ left: `${at * 100}%` }} />
        ))}
        {thumb && (
          <span
            className={`${styles.thumb} ${landing !== null ? styles.thumbDragging : ""}`}
            style={{ left: `${percent}%` }}
          />
        )}
        {landing !== null && (
          <span className={styles.tooltip} style={{ left: `${percent}%` }} data-testid={playerScrubberTestIds.tooltip}>
            {landingLabel(lines, landing.index, landing.seconds)}
          </span>
        )}
      </div>
    </div>
  );
}
