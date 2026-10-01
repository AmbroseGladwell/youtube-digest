import { useEffect, useState } from "react";
import type { Milestone, MilestoneId } from "@overview/domain";
import { milestoneColourStyle } from "../../util/milestoneColourStyle.js";
import { MilestoneCard } from "../MilestoneCard/MilestoneCard.js";
import styles from "./MilestoneStack.module.scss";
import { milestoneStackTestIds } from "./MilestoneStackTestIds.js";

export interface MilestoneStackProps {
  milestones: Milestone[];
  minutes: number;
  onShown: (id: MilestoneId) => void;
  onDismiss: (id: MilestoneId) => void;
  onUndo: (id: MilestoneId) => void;
}

const UNDO_SHOWN_MS = 6_000;
const PLATES = 2;

// Design 34ab and 34ah: one card under the filters, or, when one save crossed several,
// a stack shortest first with the next ones peeking out underneath in their own colours.
// × brings the next forward; the last × leaves a moment to undo it
// (docs/features/time-saved.md, "When a milestone shows").
export function MilestoneStack({ milestones, minutes, onShown, onDismiss, onUndo }: MilestoneStackProps) {
  const [dismissedHere, setDismissedHere] = useState(0);
  const [undoable, setUndoable] = useState<MilestoneId | null>(null);
  const front = milestones[0];
  const behind = milestones.slice(1, 1 + PLATES);
  const total = dismissedHere + milestones.length;

  useEffect(() => {
    if (front !== undefined) {
      onShown(front.id);
    }
  }, [front?.id]);

  useEffect(() => {
    if (milestones.length === 0 && undoable === null) {
      setDismissedHere(0);
    }
  }, [milestones.length, undoable]);

  useEffect(() => {
    if (undoable === null) {
      return;
    }
    const timer = setTimeout(() => setUndoable(null), UNDO_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [undoable]);

  if (front === undefined) {
    return undoable === null ? null : (
      <div className={styles.undo} role="status" data-testid={milestoneStackTestIds.undoNote}>
        <span>Hidden until your next milestone</span>
        <button
          type="button"
          className={styles.undoButton}
          onClick={() => {
            onUndo(undoable);
            setUndoable(null);
            setDismissedHere((count) => Math.max(0, count - 1));
          }}
          data-testid={milestoneStackTestIds.undoButton}
        >
          Undo
        </button>
      </div>
    );
  }

  const several = total > 1;
  const dismiss = () => {
    onDismiss(front.id);
    setDismissedHere((count) => count + 1);
    setUndoable(milestones.length === 1 ? front.id : null);
  };

  return (
    <div className={styles.root} data-testid={milestoneStackTestIds.root}>
      {several && (
        <p className={styles.count} data-testid={milestoneStackTestIds.count}>
          {dismissedHere + 1} of {total} new milestones
        </p>
      )}
      <div className={styles.stack} style={{ paddingBottom: `${behind.length * 7}px` }}>
        {behind.map((milestone, index) => (
          <div
            key={milestone.id}
            className={styles.plate}
            style={{
              ...milestoneColourStyle(milestone.id),
              left: `${8 * (index + 1)}px`,
              right: `${8 * (index + 1)}px`,
              bottom: `${7 * (behind.length - 1 - index)}px`,
              zIndex: -index,
            }}
            aria-hidden="true"
          />
        ))}
        <MilestoneCard
          key={front.id}
          milestone={front}
          minutes={minutes}
          dismissLabel={several ? "Hide this milestone" : "Hide until your next milestone"}
          onDismiss={dismiss}
          shimmerIndex={dismissedHere}
        />
      </div>
    </div>
  );
}
