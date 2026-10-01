import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { spokenTimeSaved, type Milestone, type MilestoneLineControl } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { MILESTONE_LINES } from "../../util/milestoneLines.js";
import { milestoneColourStyle } from "../../util/milestoneColourStyle.js";
import { TimeSavedFigure } from "../TimeSavedFigure/TimeSavedFigure.js";
import { useCyclingLines } from "./useCyclingLines.js";
import styles from "./MilestoneCard.module.scss";
import { milestoneCardTestIds } from "./MilestoneCardTestIds.js";

export interface MilestoneCardProps {
  milestone: Milestone;
  minutes: number;
  dismissLabel: string;
  onDismiss: () => void;
  onLineChosen: (by: MilestoneLineControl) => void;
  // Staggers the light that passes over the card, so a stack's cards never sweep together.
  shimmerIndex?: number;
}

const SWIPE_DISTANCE = 44;
const AXIS_LOCK_DISTANCE = 6;
const ENTRANCE_ROLL_MINUTES = 6;

interface Drag {
  x: number;
  y: number;
  dx: number;
  axis: "x" | "y" | null;
}

// Design 34za: a tile tinted in the milestone's colour, its pill, the total rolling in,
// and five lines that cycle, swipe and step with the arrow keys
// (docs/features/time-saved.md).
export function MilestoneCard({ milestone, minutes, dismissLabel, onDismiss, onLineChosen, shimmerIndex = 0 }: MilestoneCardProps) {
  const lines = MILESTONE_LINES[milestone.id];
  const [held, setHeld] = useState({ hover: false, focus: false, drag: false });
  const paused = held.hover || held.focus || held.drag;
  const { line, durationMs, step, jumpTo } = useCyclingLines(lines, paused);
  const drag = useRef<Drag | null>(null);
  const currentLine = useRef<HTMLParagraphElement | null>(null);

  const hold = (key: keyof typeof held, value: boolean) => setHeld((current) => ({ ...current, [key]: value }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    drag.current = { x: event.clientX, y: event.clientY, dx: 0, axis: null };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current === null) {
      return;
    }
    const moveX = event.clientX - current.x;
    const moveY = event.clientY - current.y;
    if (current.axis === null && Math.hypot(moveX, moveY) > AXIS_LOCK_DISTANCE) {
      current.axis = Math.abs(moveX) > Math.abs(moveY) ? "x" : "y";
      if (current.axis === "x") {
        event.currentTarget.setPointerCapture(event.pointerId);
        hold("drag", true);
      }
    }
    if (current.axis !== "x" || currentLine.current === null) {
      return;
    }
    current.dx = moveX;
    const resisted = moveX / (1 + Math.abs(moveX) / 120);
    currentLine.current.style.transform = `translateX(${resisted}px)`;
    currentLine.current.style.opacity = String(Math.max(0.25, 1 - Math.abs(moveX) / 160));
  };

  const onPointerEnd = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.axis !== "x") {
      return;
    }
    if (currentLine.current !== null) {
      currentLine.current.style.transform = "";
      currentLine.current.style.opacity = "";
    }
    if (Math.abs(current.dx) > SWIPE_DISTANCE) {
      step(current.dx < 0 ? 1 : -1);
      onLineChosen("swipe");
    }
    hold("drag", false);
  };

  const enterClass =
    line.direction === 1 ? styles.enterFromRight : line.direction === -1 ? styles.enterFromLeft : styles.enterRise;
  const leaveClass =
    line.direction === 1 ? styles.leaveToLeft : line.direction === -1 ? styles.leaveToRight : styles.leaveRise;

  return (
    <div
      className={styles.root}
      style={{ ...milestoneColourStyle(milestone.id), "--shimmer-delay": `${1200 + (shimmerIndex % 10) * 380}ms` } as CSSProperties}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${milestone.label} milestone. Swipe or use arrow keys for more.`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          step(event.key === "ArrowRight" ? 1 : -1);
          onLineChosen("keys");
        }
      }}
      onMouseEnter={() => hold("hover", true)}
      onMouseLeave={() => hold("hover", false)}
      onFocus={() => hold("focus", true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          hold("focus", false);
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      data-milestone={milestone.id}
      data-testid={milestoneCardTestIds.root}
    >
      <span className={styles.shimmer} aria-hidden="true" />
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label={dismissLabel}
        title={dismissLabel}
        data-testid={milestoneCardTestIds.dismissButton}
      >
        <StrokeIcon name="close" size={15} />
      </button>
      <p className={styles.pill} data-testid={milestoneCardTestIds.pill}>
        {milestone.label} saved
      </p>
      <p className={styles.figure} aria-label={`Time saved: ${spokenTimeSaved(minutes)}`} data-testid={milestoneCardTestIds.figure}>
        <TimeSavedFigure
          minutes={minutes}
          rollFrom={Math.max(0, minutes - ENTRANCE_ROLL_MINUTES)}
          rollDelayMs={500}
        />
      </p>
      <div className={styles.lines} aria-live="off">
        {lines.map((text, index) => (
          <p key={`sizer-${index}`} className={styles.sizer} aria-hidden="true">
            {text}
          </p>
        ))}
        {line.previous !== null && (
          <p key={`leaving-${line.turn}`} className={`${styles.line} ${styles.leaving} ${leaveClass}`} aria-hidden="true">
            {lines[line.previous]}
          </p>
        )}
        <p
          key={`current-${line.turn}`}
          ref={currentLine}
          className={`${styles.line} ${line.turn > 0 ? enterClass : ""}`}
          data-testid={milestoneCardTestIds.line}
        >
          {lines[line.index]}
        </p>
      </div>
      <div className={styles.dots}>
        {lines.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`${styles.dot} ${index === line.index ? styles.dotCurrent : ""}`}
            onClick={() => {
              if (index !== line.index) {
                jumpTo(index);
                onLineChosen("dot");
              }
            }}
            aria-label={`Line ${index + 1} of ${lines.length}`}
            aria-current={index === line.index}
            data-testid={milestoneCardTestIds.dot(index)}
          >
            {index === line.index && (
              <span
                key={line.turn}
                className={`${styles.fill} ${paused ? styles.fillPaused : ""}`}
                style={{ animationDuration: `${durationMs}ms` }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
