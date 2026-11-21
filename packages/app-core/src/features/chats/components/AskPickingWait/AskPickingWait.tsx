import { useEffect, useId, useState } from "react";
import { Routes } from "../../../../app/Routes.js";
import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { PickedOverview } from "../../useAskOver.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import styles from "./AskPickingWait.module.scss";
import { askPickingWaitTestIds } from "./AskPickingWaitTestIds.js";

export const SLOW_PICKING_MS = 10_000;

export interface AskPickingWaitProps {
  // Choosing what to read, reading what was chosen, or read, once the answer has begun.
  phase: "choosing" | "reading" | "read";
  picked: readonly PickedOverview[];
  imageOf: (overviewId: string) => { url: string | null; wide: boolean };
  holds: (overviewId: string) => boolean;
  onOpened: () => void;
  onFollow: () => void;
}

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

function Tick({ done }: { done: boolean }) {
  return (
    <span className={`${styles.mark} ${done ? styles.done : ""}`} aria-hidden="true">
      {done ? (
        <svg viewBox="0 0 18 18" className={styles.tick}>
          <circle cx="9" cy="9" r="9" />
          <path d="M5.2 9.4l2.5 2.4 5-5.2" />
        </svg>
      ) : (
        <span className={styles.loader}>
          <OverviewMark />
        </span>
      )}
    </span>
  );
}

// OV-354, page 3 (354v, the mp4): a small muted list while a library or project question chooses
// what to read, then reads it, its titles named by code from the ids; once the answer begins it
// folds into one "Read 5 overviews" line that opens to show them as chips. Reduced motion has no
// spin, slide or drawing (AskPickingWait.module.scss).
export function AskPickingWait({ phase, picked, imageOf, holds, onOpened, onFollow }: AskPickingWaitProps) {
  const [slow, setSlow] = useState(false);
  const [open, setOpen] = useState(false);
  const chipsId = useId();

  useEffect(() => {
    setSlow(false);
    if (phase !== "choosing") return;
    const timer = setTimeout(() => setSlow(true), SLOW_PICKING_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "read")
    return (
      <div className={styles.folded} data-testid={askPickingWaitTestIds.root}>
        <button
          type="button"
          className={styles.readLine}
          aria-expanded={open}
          aria-controls={chipsId}
          onClick={() => {
            if (!open) onOpened();
            setOpen(!open);
          }}
          data-testid={askPickingWaitTestIds.read}
        >
          <Tick done />
          Read {overviews(picked.length)}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
            <StrokeIcon name="chevronDown" size={14} />
          </span>
        </button>
        {open && (
          <div className={styles.chips} id={chipsId} data-testid={askPickingWaitTestIds.readChips}>
            {picked.map((overview) => {
              const image = imageOf(overview.overviewId);
              const held = holds(overview.overviewId);
              return (
                <ChatSourceChip
                  key={overview.overviewId}
                  title={overview.title}
                  label={overview.title}
                  imageUrl={image.url}
                  wide={image.wide}
                  deleted={!held}
                  deletedDetail="an overview you deleted"
                  {...(held ? { to: Routes.overview(overview.overviewId), onFollow } : {})}
                />
              );
            })}
          </div>
        )}
      </div>
    );

  const reading = phase === "reading";
  return (
    <ol className={styles.root} data-testid={askPickingWaitTestIds.root}>
      <li className={`${styles.step} ${reading ? "" : styles.running}`} data-testid={askPickingWaitTestIds.step}>
        <Tick done={reading} />
        <span>
          {reading ? "Chosen" : "Choosing which overviews to read"}
          {!reading && <span className={styles.hint}> · A few seconds</span>}
        </span>
      </li>
      {!reading && slow && (
        <li className={styles.slow} data-testid={askPickingWaitTestIds.slow}>
          Still choosing, slow connection
        </li>
      )}
      <li className={`${styles.step} ${reading ? styles.running : ""}`} data-testid={askPickingWaitTestIds.step}>
        <Tick done={false} />
        <span>
          {reading ? `Reading ${overviews(picked.length)}` : "Reading"}
          <span className={styles.hint}> · Then the answer</span>
        </span>
      </li>
      {reading && (
        <li className={styles.titles}>
          <ul>
            {picked.map((overview, index) => (
              <li
                key={overview.overviewId}
                className={styles.title}
                style={{ animationDelay: `${index * 80}ms` }}
                data-testid={askPickingWaitTestIds.title}
              >
                {overview.title}
              </li>
            ))}
          </ul>
        </li>
      )}
    </ol>
  );
}
